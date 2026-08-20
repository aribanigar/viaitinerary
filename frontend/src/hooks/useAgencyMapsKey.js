import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { fetchSettings } from "../api/settings";

// Google Maps is opt-in per agency (Settings → Integrations). Cached at
// module scope so every component that needs it (Hotel Name autocomplete,
// the location map) shares one /settings fetch per session instead of each
// re-fetching it independently.
let cache = null; // { token, key }

export function useAgencyMapsKey() {
  const { token } = useAuth();
  const [key, setKey] = useState(cache?.token === token ? cache.key : null);

  useEffect(() => {
    if (!token) return;
    if (cache?.token === token) {
      setKey(cache.key);
      return;
    }
    let cancelled = false;
    fetchSettings(token)
      .then((data) => {
        const mapsKey = data?.googleMapsApiKey || null;
        cache = { token, key: mapsKey };
        if (!cancelled) setKey(mapsKey);
      })
      .catch(() => {
        if (!cancelled) setKey(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return key;
}
