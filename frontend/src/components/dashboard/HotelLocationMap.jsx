import React, { useEffect, useRef } from "react";
import { Map as MapIcon } from "lucide-react";
import { useGoogleMapsScript } from "../../hooks/useGoogleMapsScript";
import { useAgencyMapsKey } from "../../hooks/useAgencyMapsKey";

// Desaturated grey theme so the embedded map matches the app's monochrome
// palette instead of Google's default blue/green styling.
const GREY_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#f3f3f4" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a93a2" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f3f3f4" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#dcdde0" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#e2e3e5" }] },
  { featureType: "road.arterial", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#dcdde0" }] },
];

const HotelLocationMap = ({ latitude, longitude, name, location }) => {
  const mapsKey = useAgencyMapsKey();
  const { loaded, hasKey } = useGoogleMapsScript(mapsKey);
  const mapRef = useRef(null);
  const mapObj = useRef(null);

  const hasCoords = latitude != null && longitude != null;

  useEffect(() => {
    if (!loaded || !hasCoords || !mapRef.current || !window.google?.maps) return;

    const center = { lat: latitude, lng: longitude };
    if (!mapObj.current) {
      mapObj.current = new window.google.maps.Map(mapRef.current, {
        center,
        zoom: 14,
        disableDefaultUI: true,
        zoomControl: true,
        styles: GREY_MAP_STYLE,
      });
    } else {
      mapObj.current.setCenter(center);
    }

    new window.google.maps.Marker({
      position: center,
      map: mapObj.current,
      title: name,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 9,
        fillColor: "#e7f63c",
        fillOpacity: 1,
        strokeColor: "#181c22",
        strokeWeight: 2,
      },
    });
  }, [loaded, hasCoords, latitude, longitude, name]);

  if (hasCoords && loaded) {
    return <div ref={mapRef} className="w-full h-[160px] rounded-[24px] overflow-hidden" />;
  }

  return (
    <div className="relative rounded-[24px] bg-[#f3f3f4] border border-black/5 p-5 overflow-hidden">
      <div className="flex items-center gap-3">
        <div className="grid place-items-center w-10 h-10 rounded-xl bg-white border border-black/5 shadow-sm shrink-0">
          <MapIcon className="w-4 h-4 text-[#181c22]/60" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-[#181c22] truncate">
            {location || "No location set"}
          </p>
          <p className="text-[10px] text-[#9aa3b2] font-medium">
            {!hasKey
              ? "Google Maps isn't configured yet."
              : hasCoords
                ? "Loading map…"
                : "Re-save this hotel with the Google-assisted city field to plot it here."}
          </p>
        </div>
      </div>
    </div>
  );
};

export default HotelLocationMap;
