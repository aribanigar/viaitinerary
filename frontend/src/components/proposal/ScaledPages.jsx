import React, { useEffect, useRef, useState } from "react";

// The itinerary templates are laid out at A4 width (210mm ≈ 794px). Scale the
// pages down to fit the available width (never up), using CSS `zoom` so the
// scaled height takes part in layout and the page scrolls naturally.
const A4_PX = 794;

export default function ScaledPages({ children, gutter = 16 }) {
  const ref = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width || el.clientWidth;
      const next = Math.min(1, Math.max(0.2, (width - gutter * 2) / A4_PX));
      setScale((prev) => (Math.abs(prev - next) < 0.002 ? prev : next));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [gutter]);

  return (
    <div ref={ref} className="w-full flex justify-center">
      <div
        className="w-[210mm] shrink-0 origin-top bg-white shadow-[0_24px_60px_-30px_rgba(16,24,42,0.45)]"
        style={{ zoom: scale }}
      >
        {children}
      </div>
    </div>
  );
}
