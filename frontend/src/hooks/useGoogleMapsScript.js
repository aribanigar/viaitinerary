import { useEffect, useState } from "react";

// Fallback for local/dev use only — in production each agency brings its own
// key from Settings, since a single shared platform key can't satisfy every
// agency's own Google Cloud project/billing setup.
const ENV_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const CALLBACK_NAME = "__viaItineraryGoogleMapsLoaded";

const loadPromisesByKey = new Map();

function loadScript(apiKey) {
  if (loadPromisesByKey.has(apiKey)) return loadPromisesByKey.get(apiKey);
  const promise = new Promise((resolve, reject) => {
    if (window.google?.maps?.places) {
      resolve();
      return;
    }
    window[CALLBACK_NAME] = () => resolve();
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=${CALLBACK_NAME}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps."));
    document.head.appendChild(script);
  });
  loadPromisesByKey.set(apiKey, promise);
  return promise;
}

// Shared loader — the script tag + callback are only ever added once per
// page/key, no matter how many components need Places/Maps.
//
// `apiKey` is the agency's own key from Settings (Google Maps is opt-in per
// agency). Falls back to VITE_GOOGLE_MAPS_API_KEY for local/dev use when no
// agency key is configured. With neither, `hasKey` is false and nothing is
// ever fetched — callers should fall back to plain manual entry.
export function useGoogleMapsScript(apiKey) {
  const key = apiKey || ENV_API_KEY || null;
  const [loaded, setLoaded] = useState(() => !!window.google?.maps?.places);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!key || loaded) return;
    let cancelled = false;
    loadScript(key)
      .then(() => {
        if (!cancelled) setLoaded(true);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [key, loaded]);

  return { loaded, error, hasKey: !!key };
}
