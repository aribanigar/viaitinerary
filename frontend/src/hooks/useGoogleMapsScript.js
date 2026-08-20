import { useEffect, useState } from "react";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const CALLBACK_NAME = "__viaItineraryGoogleMapsLoaded";

let loadPromise = null;

function loadScript() {
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    if (!API_KEY) {
      reject(new Error("Google Maps API key is not configured."));
      return;
    }
    if (window.google?.maps?.places) {
      resolve();
      return;
    }
    window[CALLBACK_NAME] = () => resolve();
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places&callback=${CALLBACK_NAME}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps."));
    document.head.appendChild(script);
  });
  return loadPromise;
}

// Shared loader — the script tag + callback are only ever added once per
// page, no matter how many components need Places/Maps.
export function useGoogleMapsScript() {
  const [loaded, setLoaded] = useState(() => !!window.google?.maps?.places);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (loaded) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (!cancelled) setLoaded(true);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [loaded]);

  return { loaded, error, hasKey: !!API_KEY };
}
