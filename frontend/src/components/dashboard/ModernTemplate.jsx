import React from "react";
import { Star } from "lucide-react";
import ClassicTemplate from "./ClassicTemplate";

const WhatsAppIcon = ({ size = 16, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    style={{ display: "inline-block", verticalAlign: "middle" }}
    className={className}
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.148-.67-1.611-.918-2.214-.242-.588-.487-.51-.67-.52-.172-.01-.371-.012-.57-.012-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-4.821 4.754a8.117 8.117 0 01-4.077-1.092l-.293-.174-3.027.794.809-2.952-.19-.303a8.12 8.12 0 01-1.245-4.32c0-4.482 3.645-8.127 8.133-8.127 2.173 0 4.215.846 5.753 2.384 1.538 1.538 2.383 3.579 2.383 5.753 0 4.483-3.645 8.127-8.133 8.127M12 2.045c-5.466 0-9.911 4.446-9.911 9.911 0 1.758.459 3.474 1.33 4.997L2.045 21.955l5.088-1.336c1.479.807 3.147 1.234 4.845 1.234 5.467 0 9.912-4.447 9.912-9.911 0-2.648-1.03-5.138-2.903-7.01C17.138 3.073 14.647 2.045 12 2.045" />
  </svg>
);

const ModernTemplate = ({
  tripInfo,
  itinerary = [],
  destinations = [],
  accommodations = [],
  transportation = [],
  agencySettings = {},
  inclusions = [],
  exclusions = [],
  policies = {},
  includeGST = true,
}) => {
  const formatImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith("http") || path.startsWith("data:")) return path;
    const apiBaseUrl =
      import.meta.env.VITE_API_URL || "http://localhost:8000/api";
    return `${apiBaseUrl}/storage/${path}`;
  };

  const clientNameRaw = (tripInfo.clientName || "Guest").trim();
  const nameParts = clientNameRaw.split(/\s+/);
  const firstName =
    nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : "";
  const lastName = nameParts[nameParts.length - 1] || "";

  const brandColor = agencySettings.brandColor || "#FAA61A";
  const darkGreen = agencySettings.secondaryColor || "#0D2D2D";
  const headerGreen = agencySettings.secondaryColor || "#0D2D2D";
  const fontFamily = agencySettings.fontFamily || "Montserrat";

  // Sort and group transportation

  const getDateSortValue = (value) => {
    const parsed = parseAccommodationDate(value);
    return parsed ? parsed.getTime() : Number.POSITIVE_INFINITY;
  };

  const toDateKey = (value) => {
    const parsed = parseAccommodationDate(value);
    if (!parsed) return null;
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  // Sort and group transportation
  const sortedTransportation = [...transportation].sort((a, b) => {
    const aTime = getDateSortValue(a.date);
    const bTime = getDateSortValue(b.date);
    return aTime - bTime;
  });

  const uniqueTransportDateKeys = [
    ...new Set(
      sortedTransportation.map((t) => toDateKey(t.date)).filter(Boolean),
    ),
  ].sort();

  const getTotalExtraBeds = (hotel) => {
    const extraBeds5To12 = Number(
      hotel.extraBeds5To12Count ?? hotel.extra_beds_5_to_12_count ?? 0,
    );
    const extraBedsAbove12 = Number(
      hotel.extraBedsAbove12Count ?? hotel.extra_beds_above_12_count ?? 0,
    );

    if (extraBeds5To12 > 0 || extraBedsAbove12 > 0) {
      return extraBeds5To12 + extraBedsAbove12;
    }

    return Number(hotel.beds || 0);
  };

  function parseAccommodationDate(dateValue) {
    if (!dateValue) return null;
    if (dateValue instanceof Date) {
      return Number.isNaN(dateValue.getTime()) ? null : dateValue;
    }

    const raw = String(dateValue).trim();

    // YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      const parsed = new Date(Number(year), Number(month) - 1, Number(day));
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    // DD-MM-YYYY or DD/MM/YYYY
    const dmyMatch = raw.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})(?:\s+.*)?$/);
    if (dmyMatch) {
      const [, day, month, year] = dmyMatch;
      const parsed = new Date(Number(year), Number(month) - 1, Number(day));
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  // Function to calculate day numbers for accommodation
  const getAccommodationDays = (hotel, index) => {
    const actualIndex = index + 1;
    const suffixes = ["st", "nd", "rd"];
    const suffix =
      actualIndex % 10 < 4 &&
      actualIndex % 10 > 0 &&
      (actualIndex % 100 < 10 || actualIndex % 100 > 20)
        ? suffixes[(actualIndex % 10) - 1]
        : "th";

    return `${actualIndex}${suffix}`;
  };

  // Check if using Classic Template
  if (tripInfo.template === "ClassicTemplate") {
    return (
      <ClassicTemplate
        tripInfo={tripInfo}
        itinerary={itinerary}
        destinations={destinations}
        accommodations={accommodations}
        transportation={transportation}
        agencySettings={agencySettings}
        inclusions={inclusions}
        exclusions={exclusions}
        policies={policies}
        includeGST={includeGST}
      />
    );
  }

  // Default: Modern Template
  return (
    <div
      id="print-content"
      className="trip-preview-wrapper bg-transparent print:bg-white"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=${fontFamily.replace(/\s+/g, "+")}:wght@300;400;500;600;700;800;900&display=swap');
        
        .trip-preview-wrapper {
          --primary-orange: ${brandColor};
          --dark-green: ${darkGreen};
          --header-green: ${headerGreen};
          --light-bg: #FDF9F0;
          --text-gray: #333;
          --white: #ffffff;
        }

        .trip-preview-wrapper * { 
          margin: 0; 
          padding: 0; 
          box-sizing: border-box; 
          font-family: '${fontFamily}', sans-serif; 
        }

        .trip-preview-wrapper .page {
          width: 210mm;
          min-height: 297mm;
          margin: 40px auto;
          background: var(--white);
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 0 20px rgba(0,0,0,0.1);
          page-break-inside: avoid;
        }

        .pdf-export-mode.trip-preview-wrapper {
          padding: 0 !important;
          margin: 0 !important;
          background: white !important;
          width: 210mm !important;
          max-width: 210mm !important;
          display: block !important;
        }

        .pdf-export-mode.trip-preview-wrapper .page {
          margin: 0 !important;
          padding: 0 !important;
          box-shadow: none !important;
          width: 210mm !important;
          max-width: 210mm !important;
          min-height: 297mm !important;
          height: 297mm !important; /* Slightly less than 297mm to prevent 1px bleed from next page */
          border: none !important;
          position: relative !important;
          overflow: hidden !important;
          page-break-after: avoid !important; /* Avoid double breaks with avoid-all mode */
          page-break-before: avoid !important;
          page-break-inside: avoid !important;
        }

        .pdf-export-mode.trip-preview-wrapper .page:last-child {
          page-break-after: avoid !important;
        }

        @media print {
          .trip-preview-wrapper { background: none; padding: 0; }
          .trip-preview-wrapper .page { margin: 0; box-shadow: none; page-break-after: always; }
          .trip-preview-wrapper .page:last-child { page-break-after: avoid; }
          .trip-preview-wrapper .print\\:p-0 { padding: 0 !important; }
          .trip-preview-wrapper .print\\:bg-white { background-color: white !important; }
        }

        .orange-header-label {
          background: var(--primary-orange);
          color: white;
          padding: 15px 60px 15px 40px;
          display: inline-block;
          width: auto;
          min-width: 250px;
          max-width: 550px;
          border-bottom-right-radius: 40px;
          z-index: 10;
        }
        .orange-header-label.secondary {
          display: inline-block;
          width: fit-content;
          min-width: unset;
          max-width: 550px;
          border-radius: 0;
          padding-right: 40px;
        }
        .orange-header-label h1 { font-weight: 800; font-size: 32px; letter-spacing: 1px; white-space: nowrap; }
        .orange-header-label p { font-size: 10px; font-weight: 600; letter-spacing: 1.5px; white-space: nowrap; }

        .brand-logo-right {
          position: absolute;
          top: 30px;
          right: 40px;
          text-align: right;
          color: var(--dark-green);
        }
        .brand-logo-right h2 { font-weight: 800; letter-spacing: 5px; font-size: 24px; margin-bottom: -5px; }
        .brand-logo-right span { font-size: 10px; letter-spacing: 3px; font-weight: 600; }

        .header-logo {
          max-height: 80px;
          max-width: 280px;
          object-fit: contain;
          display: inline-block;
        }

        .section-bar {
          background: var(--header-green);
          color: white;
          margin-top: 20px;
          padding: 12px 60px;
          position: relative;
          width: 95%;
          border-left: 25px solid var(--dark-green);
          display: flex;
          align-items: center;
        }
        .section-bar h2 { font-size: 24px; font-weight: 700; letter-spacing: 1px; }
        .section-bar::after { content: '///'; position: absolute; right: 20px; top: -10px; color: var(--primary-orange); font-size: 22px; font-weight: 900; transform: rotate(-10deg); }

        .footer {
          padding: 10px 60px 30px 60px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
          font-weight: 600;
          color: var(--dark-green);
        }
        .footer-line { width: 250px; height: 3px; background: var(--primary-orange); margin: 0 0 10px 60px; }

        .hero-1 { height: 600px; background-position: center; background-size: cover; position: relative; }
        .hero-1::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.4);
          z-index: 1;
        }
        .hero-1-label { position: absolute; bottom: 40px; width: 100%; text-align: center; color: white; z-index: 2; }
        .hero-1-label h1 { font-size: 68px; font-weight: 900; line-height: 0.9; text-shadow: 0 4px 10px rgba(0,0,0,0.3); }
        .hero-1-label p { font-size: 16px; letter-spacing: 4px; font-weight: 600; margin-top: 10px; }
        .cover-content { background: var(--dark-green); color: white; padding: 40px 60px; flex-grow: 1; }
        .price-card { width: 260px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); padding: 16px; border-radius: 16px; margin-top: 24px; margin-left: auto; position: relative; }

        .hotel-card { background: var(--light-bg); margin: 20px 40px; padding: 25px; border-radius: 15px; display: flex; align-items: center; gap: 20px; }
        .hotel-info { flex: 1; }
        .hotel-img { width: 280px; height: 180px; border-radius: 15px; background-size: cover; background-position: center; }
        .night-badge { background: var(--dark-green); color: white; padding: 5px 12px; border-radius: 5px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 10px; }
        .stars { color: var(--primary-orange); margin: 10px 0; display: flex; gap: 2px; }

        .day-header { display: flex; align-items: center; padding: 30px 60px; gap: 20px; }
        .day-badge { background: var(--dark-green); color: var(--primary-orange); width: 80px; height: 80px; border-radius: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 900; }
        .day-badge span { font-size: 10px; color: var(--primary-orange); }
        .day-badge b { font-size: 38px; line-height: 1; }
        .day-title { flex: 1; }
        .day-title p { 
          font-size: 16px; 
          font-weight: 600; 
          color: #666; 
          display: flex; 
          align-items: center; 
          justify-content: space-between;
          width: 100%; 
        }
        .day-title h3 { font-size: 24px; font-weight: 800; color: var(--dark-green); text-transform: uppercase; }
        .day-hero { width: 100%; height: 320px; background-size: cover; background-position: center; }
        .activities { padding: 40px 80px; }
        .activities h4 { font-size: 28px; font-weight: 900; color: var(--dark-green); margin-bottom: 20px; }
        .activities ul { list-style: none; }
        .activities li { margin-bottom: 15px; padding-left: 20px; position: relative; line-height: 1.5; font-weight: 500; color: var(--text-gray); }
        .activities li::before { content: "•"; color: var(--header-green); font-size: 24px; position: absolute; left: 0; top: -5px; }

        .itinerary-table { width: 90%; margin: 40px auto; border-collapse: collapse; }
        .itinerary-table th { background: #f8f8f8; text-align: left; padding: 15px; border: 1px solid #ddd; font-weight: 700; color: var(--dark-green); }
        .itinerary-table td { padding: 15px; border: 1px solid #ddd; vertical-align: middle; color: var(--text-gray); }

        .must-haves-list { list-style: none; padding: 20px 60px; }
        .must-haves-list li { margin-bottom: 12px; padding-left: 25px; position: relative; font-weight: 500; color: var(--text-gray); }
        .must-haves-list li::before { content: "✓"; color: var(--primary-orange); font-weight: 900; position: absolute; left: 0; }
      `,
        }}
      />

      <div className="page" style={{ background: "var(--dark-green)" }}>
        <div
          className="orange-header-label"
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          {agencySettings.logo ? (
            <img
              src={formatImageUrl(agencySettings.logo)}
              alt="Logo"
              className="header-logo"
            />
          ) : (
            <>
              <h1 style={{ fontSize: "24px" }}>
                {(agencySettings.agencyName || "VIAKASHMIR").toUpperCase()}
              </h1>
              <p>TRAVEL SIMPLIFIED</p>
            </>
          )}
        </div>
        <div
          className="hero-1"
          style={{
            backgroundImage: `url(${
              formatImageUrl(tripInfo.image) ||
              "https://images.unsplash.com/photo-1598091383021-15ddea10925d?auto=format&fit=crop&q=80&w=1000"
            })`,
          }}
        >
          <div className="hero-1-label">
            <h1 className="uppercase">
              {tripInfo.duration || "0"} NIGHT{" "}
              {parseInt(tripInfo.duration || 0) + 1} DAYS
            </h1>
            <p>
              TRAVEL ITINERARY BY{" "}
              {(agencySettings.agencyName || "VIA KASHMIR").toUpperCase()}
            </p>
          </div>
        </div>
        <div
          style={{
            background: "var(--primary-orange)",
            color: "white",
            textAlign: "center",
            padding: "10px",
            fontSize: "11px",
            fontWeight: "700",
          }}
        >
          {tripInfo.tagline ||
            agencySettings.tagline ||
            "BOOK VERIFIED HOTELS, CABS, HORSES, SHIKARAS, HOUSEBOATS, TOUR PACKAGES, ACTIVITIES, VISITS"}
        </div>
        <div
          className="cover-content"
          style={{ position: "relative", minHeight: "450px" }}
        >
          <h2>
            Dear{" "}
            <b>
              {firstName}
              {firstName && " "}
              {lastName}
            </b>
            ,
          </h2>
          <p style={{ margin: "15px 0", opacity: "0.8", lineHeight: "1.6" }}>
            {(
              agencySettings.greetingMessage ||
              "Greetings from {agencyName}. Our team has put up this Quote regarding your upcoming trip. Please review it and let us know if you would like any changes."
            ).replace(
              /{agencyName}/g,
              (agencySettings.agencyName || "Via Kashmir").toUpperCase(),
            )}
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 1fr 1fr",
              gap: "20px",
              borderTop: "1px solid rgba(255,255,255,0.1)",
              paddingTop: "30px",
            }}
          >
            <div>
              <label
                style={{
                  fontSize: "12px",
                  opacity: "0.6",
                  display: "block",
                  marginBottom: "5px",
                }}
              >
                Destination
              </label>
              <div style={{ fontSize: "22px", fontWeight: "600" }}>
                {tripInfo.destination || "Jammu & Kashmir"}
              </div>
            </div>
            <div>
              <label
                style={{
                  fontSize: "12px",
                  opacity: "0.6",
                  display: "block",
                  marginBottom: "5px",
                }}
              >
                Start Date
              </label>
              <div style={{ fontSize: "22px", fontWeight: "600" }}>
                {tripInfo.startDate || "TBD"}
              </div>
            </div>
            <div>
              <label
                style={{
                  fontSize: "12px",
                  opacity: "0.6",
                  display: "block",
                  marginBottom: "5px",
                }}
              >
                Duration
              </label>
              <div style={{ fontSize: "22px", fontWeight: "600" }}>
                {tripInfo.duration}N/{parseInt(tripInfo.duration || 0) + 1}D
              </div>
            </div>
            <div style={{ marginTop: "15px" }}>
              <label
                style={{
                  fontSize: "12px",
                  opacity: "0.6",
                  display: "block",
                  marginBottom: "5px",
                }}
              >
                Pax
              </label>
              <div style={{ fontSize: "22px", fontWeight: "600" }}>
                {tripInfo.adults ? `${tripInfo.adults} Adults` : "2 Adults"}
                {Number(tripInfo.kidsUpto5 || 0) +
                  Number(tripInfo.kids5to12 || 0) >
                0
                  ? `, ${Number(tripInfo.kidsUpto5 || 0) + Number(tripInfo.kids5to12 || 0)} Kids`
                  : ""}
              </div>
            </div>
            <div style={{ marginTop: "15px" }}>
              <label
                style={{
                  fontSize: "12px",
                  opacity: "0.6",
                  display: "block",
                  marginBottom: "5px",
                }}
              >
                Trip ID
              </label>
              <div style={{ fontSize: "22px", fontWeight: "600" }}>
                {tripInfo.tripId ? `#${tripInfo.tripId}` : "—"}
              </div>
            </div>
          </div>

          <div
            className="price-card"
            style={{
              display: "flex",
              flexDirection: "column",
              marginLeft: "auto",
              marginTop: "24px",
              width: "260px",
              minWidth: "260px",
              background: "rgba(255,255,255,0.08)",
              padding: "16px",
              borderRadius: "16px",
            }}
          >
            <label
              style={{ fontSize: "12px", opacity: "0.8", marginBottom: "6px" }}
            >
              Quote Price
            </label>
            <div
              style={{
                fontSize: "18px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              Total ({tripInfo.currency?.split(" ")[0] || "INR"})
            </div>
            <div
              style={{
                fontSize: "34px",
                fontWeight: "900",
                wordBreak: "break-all",
                marginTop: "4px",
              }}
            >
              {Number(tripInfo.cost || 0).toLocaleString()}
              /-
            </div>
            {includeGST && (
              <span
                style={{
                  marginTop: "auto",
                  textAlign: "right",
                  fontStyle: "italic",
                  opacity: "0.8",
                  fontSize: "11px",
                }}
              >
                including GST/-
              </span>
            )}
            {!includeGST && (
              <span
                style={{
                  marginTop: "auto",
                  textAlign: "right",
                  fontStyle: "italic",
                  opacity: "0.8",
                  fontSize: "11px",
                }}
              >
                excluding GST/-
              </span>
            )}
          </div>
        </div>
        <div
          className="footer"
          style={{
            background: "var(--dark-green)",
            border: "none",
            color: "white",
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>{agencySettings.email}</span>
          <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <WhatsAppIcon size={14} /> {agencySettings.whatsapp}
          </span>
          <span>{agencySettings.website}</span>
        </div>
      </div>

      {/* PAGE 2: ACCOMMODATIONS */}
      {(() => {
        const hotelsPerPage = 3;

        // Group accommodations by Hotel Name, City, Category, and Room Type
        const groupedAccommodationList = [];
        if (accommodations && accommodations.length > 0) {
          const sorted = [...accommodations].sort((a, b) => {
            const aTime = getDateSortValue(a.checkIn);
            const bTime = getDateSortValue(b.checkIn);
            return aTime - bTime;
          });

          sorted.forEach((hotel) => {
            const existing = groupedAccommodationList.find(
              (g) =>
                g.name === hotel.name &&
                g.city === hotel.city &&
                g.category === hotel.category &&
                g.roomType === hotel.roomType,
            );

            if (existing) {
              if (!existing.allDates) {
                existing.allDates = [
                  { checkIn: existing.checkIn, checkOut: existing.checkOut },
                ];
              }
              existing.allDates.push({
                checkIn: hotel.checkIn,
                checkOut: hotel.checkOut,
              });

              // Recalculate nights if possible
              if (hotel.checkIn && hotel.checkOut) {
                const cIn = parseAccommodationDate(hotel.checkIn);
                const cOut = parseAccommodationDate(hotel.checkOut);
                if (cIn && cOut) {
                  const diffTime = Math.abs(cOut.getTime() - cIn.getTime());
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  existing.totalNights =
                    (existing.totalNights || 0) + (diffDays > 0 ? diffDays : 1);
                }
              }
            } else {
              let nights = 1;
              if (hotel.checkIn && hotel.checkOut) {
                const cIn = parseAccommodationDate(hotel.checkIn);
                const cOut = parseAccommodationDate(hotel.checkOut);
                if (cIn && cOut) {
                  const diffTime = Math.abs(cOut.getTime() - cIn.getTime());
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  nights = diffDays > 0 ? diffDays : 1;
                }
              }
              groupedAccommodationList.push({
                ...hotel,
                allDates: [
                  { checkIn: hotel.checkIn, checkOut: hotel.checkOut },
                ],
                totalNights: nights,
              });
            }
          });
        }

        const accommodationList =
          groupedAccommodationList.length > 0
            ? groupedAccommodationList
            : [
                {
                  id: "booked-by-guest",
                  name: "HOTEL BOOKED BY GUEST",
                },
              ];

        const hotelChunks = [];
        for (let i = 0; i < accommodationList.length; i += hotelsPerPage) {
          hotelChunks.push(accommodationList.slice(i, i + hotelsPerPage));
        }

        return hotelChunks.map((chunk, pageIndex) => (
          <div className="page" key={`hotel-page-${pageIndex}`}>
            <div className="orange-header-label secondary">
              <h1>
                {tripInfo.duration || "0"} NIGHT{" "}
                {parseInt(tripInfo.duration || 0) + 1} DAYS
              </h1>
              <p>
                TRAVEL ITINERARY BY{" "}
                {(agencySettings.agencyName || "VIA KASHMIR").toUpperCase()}
              </p>
            </div>
            <div className="brand-logo-right" style={{ top: "10px" }}>
              {agencySettings.logo ? (
                <img
                  src={formatImageUrl(agencySettings.logo)}
                  alt="Logo"
                  className="header-logo"
                />
              ) : (
                <>
                  <h2>
                    {(agencySettings.agencyName || "VIAKASHMIR").toUpperCase()}
                  </h2>
                  <span>TRAVEL SIMPLIFIED</span>
                </>
              )}
            </div>
            <div className="section-bar">
              <h2>ACCOMMODATIONS</h2>
            </div>

            {chunk.map((hotel, index) => {
              const actualIndex = pageIndex * hotelsPerPage + index;
              const totalExtraBeds = getTotalExtraBeds(hotel);

              const getOrdinal = (n) => {
                const s = ["th", "st", "nd", "rd"];
                const v = n % 100;
                return n + (s[(v - 20) % 10] || s[v] || s[0]);
              };

              let dayBadge = "";
              if (hotel.allDates) {
                const stayLabels = hotel.allDates
                  .sort(
                    (a, b) =>
                      getDateSortValue(a.checkIn) - getDateSortValue(b.checkIn),
                  )
                  .map((dateObj) => {
                    const checkInDate = dateObj.checkIn;
                    const checkOutDate = dateObj.checkOut;

                    const parsedCheckIn = parseAccommodationDate(checkInDate);
                    const parsedTripStart = parseAccommodationDate(
                      tripInfo.startDate,
                    );

                    const startDayNum =
                      parsedCheckIn && parsedTripStart
                        ? Math.max(
                            1,
                            Math.floor(
                              (parsedCheckIn.getTime() -
                                parsedTripStart.getTime()) /
                                (1000 * 60 * 60 * 24),
                            ) + 1,
                          )
                        : 1;

                    let stayNights = 1;
                    if (checkInDate && checkOutDate) {
                      const cIn = parseAccommodationDate(checkInDate);
                      const cOut = parseAccommodationDate(checkOutDate);
                      if (cIn && cOut) {
                        const diffTime = Math.abs(
                          cOut.getTime() - cIn.getTime(),
                        );
                        const diffDays = Math.ceil(
                          diffTime / (1000 * 60 * 60 * 24),
                        );
                        stayNights = diffDays > 0 ? diffDays : 1;
                      }
                    }

                    const stayDaysGroup = [];
                    for (let i = 0; i < stayNights; i++) {
                      stayDaysGroup.push(startDayNum + i);
                    }

                    const currentStayLabels = stayDaysGroup.map((d) =>
                      getOrdinal(d),
                    );

                    if (currentStayLabels.length > 2) {
                      const last = currentStayLabels.pop();
                      return `${currentStayLabels.join(", ")} & ${last}`;
                    } else if (currentStayLabels.length === 2) {
                      return `${currentStayLabels[0]} & ${currentStayLabels[1]}`;
                    } else {
                      return currentStayLabels[0];
                    }
                  });

                if (stayLabels.length > 2) {
                  const last = stayLabels.pop();
                  dayBadge = `${stayLabels.join(", ")} & ${last}`;
                } else if (stayLabels.length === 2) {
                  dayBadge = `${stayLabels[0]} & ${stayLabels[1]}`;
                } else {
                  dayBadge = stayLabels[0];
                }
              } else {
                dayBadge = "Accommodation";
              }

              return (
                <div className="hotel-card" key={hotel.id || actualIndex}>
                  <div className="hotel-info">
                    {hotel.id !== "booked-by-guest" && (
                      <>
                        <div className="night-badge">{dayBadge}</div>
                        <span style={{ fontWeight: "600", marginLeft: "10px" }}>
                          {(() => {
                            if (hotel.checkIn && hotel.checkOut) {
                              const checkInDate = parseAccommodationDate(
                                hotel.checkIn,
                              );
                              const checkOutDate = parseAccommodationDate(
                                hotel.checkOut,
                              );
                              if (!checkInDate || !checkOutDate) {
                                return "1 NIGHT AT ";
                              }

                              const nights = Math.ceil(
                                (checkOutDate.getTime() -
                                  checkInDate.getTime()) /
                                  (1000 * 60 * 60 * 24),
                              );
                              return `${nights > 1 ? "NIGHTS" : "NIGHT"} AT `;
                            }
                            return "1 NIGHT AT ";
                          })()}
                          <b>{hotel.city || "Srinagar"}</b>
                        </span>
                      </>
                    )}
                    <h3
                      style={{
                        fontSize: "26px",
                        fontWeight: "800",
                        margin: "10px 0",
                      }}
                    >
                      {hotel.name}
                    </h3>
                    {hotel.id !== "booked-by-guest" && (
                      <>
                        <div className="stars" style={{ fontSize: "18px" }}>
                          {"★"
                            .repeat(parseInt(hotel.category || 0))
                            .padEnd(5, "☆")}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "40px",
                            fontSize: "11px",
                            marginTop: "20px",
                          }}
                        >
                          <div>
                            <p>ROOMS</p>
                            <b>{hotel.rooms || "-"}</b>
                          </div>
                          {hotel.roomType && (
                            <div>
                              <p>ROOM TYPE</p>
                              <b>{hotel.roomType}</b>
                            </div>
                          )}
                          {totalExtraBeds > 0 && (
                            <div>
                              <p>EXTRA BEDS</p>
                              <b>{totalExtraBeds}</b>
                            </div>
                          )}
                          <div>
                            <p>MEAL PLAN</p>
                            <b>{hotel.mealPlan || "—"}</b>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  {hotel.id !== "booked-by-guest" && (
                    <>
                      {hotel.photo ? (
                        <div
                          className="hotel-img"
                          style={{
                            backgroundImage: `url(${formatImageUrl(
                              hotel.photo,
                            )})`,
                          }}
                        ></div>
                      ) : (
                        <div
                          className="hotel-img"
                          style={{
                            background: "#eee",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#999",
                            fontSize: "12px",
                            filter: hotel.name
                              ?.toLowerCase()
                              .includes("booked by guest")
                              ? "blur(5px)"
                              : "none",
                          }}
                        >
                          {hotel.name?.toLowerCase().includes("booked by guest")
                            ? ""
                            : "No Image"}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}

            <div style={{ flex: 1 }}></div>
            <div className="footer-line"></div>
            <div className="footer">
              <span
                style={{ display: "flex", alignItems: "center", gap: "4px" }}
              >
                <WhatsAppIcon size={14} /> WhatsApp
              </span>
              <span>{agencySettings.whatsapp}</span>
              <span>{agencySettings.email}</span>
              <span>{agencySettings.website}</span>
            </div>
          </div>
        ));
      })()}

      {/* PAGE 3: TRANSPORTATIONS */}
      <div className="page">
        <div className="orange-header-label secondary">
          <h1>
            {tripInfo.duration || "0"} NIGHT{" "}
            {parseInt(tripInfo.duration || 0) + 1} DAYS
          </h1>
          <p>
            TRAVEL ITINERARY BY{" "}
            {(agencySettings.agencyName || "VIA KASHMIR").toUpperCase()}
          </p>
        </div>
        <div className="brand-logo-right" style={{ top: "10px" }}>
          {agencySettings.logo ? (
            <img
              src={formatImageUrl(agencySettings.logo)}
              alt="Logo"
              className="header-logo"
            />
          ) : (
            <>
              <h2>
                {(agencySettings.agencyName || "VIAKASHMIR").toUpperCase()}
              </h2>
              <span>TRAVEL SIMPLIFIED</span>
            </>
          )}
        </div>
        <div className="section-bar">
          <h2>TRANSPORTATIONS</h2>
        </div>

        {transportation.length > 0 ? (
          <table className="itinerary-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Type</th>
                <th>Service/Route</th>
                <th>No. Vehicles</th>
                <th>Vehicle</th>
              </tr>
            </thead>
            <tbody>
              {sortedTransportation.map((item, index) => {
                const transportDateKey = toDateKey(item.date);
                const parsedTransportDate = parseAccommodationDate(item.date);
                const dayNumber = transportDateKey
                  ? uniqueTransportDateKeys.indexOf(transportDateKey) + 1
                  : index + 1;

                return (
                  <tr key={item.id || index}>
                    <td>
                      {dayNumber}
                      {dayNumber % 10 === 1 && dayNumber % 100 !== 11
                        ? "st"
                        : dayNumber % 10 === 2 && dayNumber % 100 !== 12
                          ? "nd"
                          : dayNumber % 10 === 3 && dayNumber % 100 !== 13
                            ? "rd"
                            : "th"}{" "}
                      Day (
                      {parsedTransportDate
                        ? parsedTransportDate.toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            weekday: "short",
                          })
                        : item.date || "—"}
                      )
                    </td>
                    <td
                      style={{
                        textTransform: "uppercase",
                        fontSize: "11px",
                        fontWeight: "900",
                        color: "#64748B",
                      }}
                    >
                      {item.tripType || "Transfer"}
                    </td>
                    <td>{item.route}</td>
                    <td
                      style={{
                        fontWeight: "800",
                        color: "#000000",
                        textAlign: "center",
                      }}
                    >
                      {item.quantity || "1"}
                    </td>
                    <td>{item.vehicleType}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: "60px", textAlign: "center", color: "#666" }}>
            <h3
              style={{ fontSize: "24px", fontWeight: "800", color: "#0D2D2D" }}
            >
              TRANSPORT BOOKED BY GUEST
            </h3>
            <p style={{ marginTop: "10px" }}>
              No transportation details have been added to this quote.
            </p>
          </div>
        )}

        <div style={{ flex: 1 }}></div>
        <div className="footer-line"></div>
        <div className="footer">
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <WhatsAppIcon size={14} /> WhatsApp
          </span>
          <span>{agencySettings.whatsapp}</span>
          <span>{agencySettings.email}</span>
          <span>{agencySettings.website}</span>
        </div>
      </div>

      {/* DAY WISE ITINERARY PAGES */}
      {itinerary.map((day, index) => (
        <div className="page" key={day.id || index}>
          <div className="orange-header-label secondary">
            <h1>
              {tripInfo.duration || "0"} NIGHT{" "}
              {parseInt(tripInfo.duration || 0) + 1} DAYS
            </h1>
            <p>
              TRAVEL ITINERARY BY{" "}
              {(agencySettings.agencyName || "VIA KASHMIR").toUpperCase()}
            </p>
          </div>
          <div className="brand-logo-right" style={{ top: "10px" }}>
            {agencySettings.logo ? (
              <img
                src={formatImageUrl(agencySettings.logo)}
                alt="Logo"
                className="header-logo"
              />
            ) : (
              <>
                <h2>
                  {(agencySettings.agencyName || "VIAKASHMIR").toUpperCase()}
                </h2>
                <span>TRAVEL SIMPLIFIED</span>
              </>
            )}
          </div>
          <div className="section-bar">
            <h2>DAY WISE ITINERARY</h2>
          </div>

          <div className="day-header">
            <div className="day-badge">
              <b>{index + 1}</b>
              <span>DAY</span>
            </div>
            <div className="day-title">
              <p>
                {index + 1}
                {index === 0
                  ? "ST"
                  : index === 1
                    ? "ND"
                    : index === 2
                      ? "RD"
                      : "TH"}{" "}
                DAY (
                {(() => {
                  // Calculate the date for this day
                  let dateToFormat;
                  if (tripInfo.startDate) {
                    const parsedStartDate = parseAccommodationDate(
                      tripInfo.startDate,
                    );
                    if (parsedStartDate) {
                      const dayDate = new Date(parsedStartDate);
                      dayDate.setDate(dayDate.getDate() + index);
                      dateToFormat = dayDate;
                    }
                  }

                  return dateToFormat
                    ? new Date(dateToFormat)
                        .toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          weekday: "short",
                        })
                        .toUpperCase()
                    : "—";
                })()}
                )
                <span
                  style={{
                    fontSize: "14px",
                    color: "var(--primary-orange)",
                    fontWeight: "700",
                  }}
                >
                  {(day.location || "TBD").toUpperCase()}
                </span>
              </p>
              <h3>
                {day.title}
                {/* {(() => {
                  // Find transportation for this day by index
                  const dayTransport = transportation[index];
                  return dayTransport && dayTransport.route
                    ? ` : ${dayTransport.route}`
                    : "";
                })()} */}
              </h3>
            </div>
          </div>
          {day.photo && (
            <div
              className="day-hero"
              style={{
                backgroundImage: `url(${formatImageUrl(day.photo)})`,
              }}
            ></div>
          )}

          <div className="activities">
            <h4>ACTIVITIES</h4>
            <ul>
              {day.description
                ?.split("\n")
                .filter((line) => line.trim())
                .map((line, i) => (
                  <li key={i}>{line.replace(/^[•\\-\\*]\\s*/, "")}</li>
                ))}
            </ul>
          </div>

          <div style={{ flex: 1 }}></div>
          <div className="footer-line"></div>
          <div className="footer">
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <WhatsAppIcon size={14} /> WhatsApp
            </span>
            <span>{agencySettings.whatsapp}</span>
            <span>{agencySettings.email}</span>
            <span>{agencySettings.website}</span>
          </div>
        </div>
      ))}

      {/* FLIGHT INFORMATION PAGE */}
      {tripInfo.useFlight &&
        tripInfo.transportDetails &&
        tripInfo.transportDetails.length > 0 && (
          <div className="page">
            <div
              className="orange-header-label secondary"
              style={{ padding: "10px 40px" }}
            >
              <h1>
                {tripInfo.duration || "0"} NIGHT{" "}
                {parseInt(tripInfo.duration || 0) + 1} DAYS
              </h1>
              <p>
                TRAVEL ITINERARY BY{" "}
                {(agencySettings.agencyName || "VIA KASHMIR").toUpperCase()}
              </p>
            </div>
            <div className="brand-logo-right">
              {agencySettings.logo ? (
                <img
                  src={formatImageUrl(agencySettings.logo)}
                  alt="Logo"
                  className="header-logo"
                />
              ) : (
                <>
                  <h2>
                    {(agencySettings.agencyName || "VIAKASHMIR").toUpperCase()}
                  </h2>
                  <span>TRAVEL SIMPLIFIED</span>
                </>
              )}
            </div>

            <div className="section-bar">
              <h2>TRANSPORTATION INFORMATION</h2>
            </div>

            <div style={{ padding: "15px 50px" }}>
              {tripInfo.transportDetails.map((transport, tIndex) => (
                <div
                  key={`transport-${tIndex}`}
                  style={{
                    background: "#f8f9fa",
                    borderRadius: "16px",
                    padding: "15px 25px",
                    border: "1px solid #eee",
                    color: "var(--dark-green)",
                    marginBottom: "20px",
                  }}
                >
                  {/* Airline and Flight Number with PNR */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "10px",
                      paddingBottom: "8px",
                      borderBottom: "1px solid #ddd",
                    }}
                  >
                    <div
                      style={{ fontSize: "14px", color: "var(--dark-green)" }}
                    >
                      <span style={{ fontWeight: "700" }}>
                        {transport.airline ||
                          (transport.transportType === "Bus"
                            ? "Bus Company"
                            : transport.transportType === "Train"
                              ? "Train Name"
                              : "N/A")}
                      </span>{" "}
                      <span style={{ fontWeight: "500" }}>
                        {transport.flightNumber || ""}
                      </span>
                      <span
                        style={{
                          marginLeft: "10px",
                          fontSize: "10px",
                          background: "#eee",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          textTransform: "uppercase",
                        }}
                      >
                        {transport.transportType || "Flight"}
                      </span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: "600",
                          textTransform: "uppercase",
                          color: "#999",
                          letterSpacing: "0.5px",
                        }}
                      >
                        PNR:
                      </span>{" "}
                      <span
                        style={{
                          fontSize: "14px",
                          fontWeight: "700",
                          letterSpacing: "1px",
                          color: "var(--dark-green)",
                        }}
                      >
                        {transport.pnrNumber || "N/A"}
                      </span>
                    </div>
                  </div>

                  {/* Flight Timeline */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "8px",
                    }}
                  >
                    <div style={{ flex: 1, textAlign: "left" }}>
                      <p
                        style={{
                          fontSize: "20px",
                          fontWeight: "700",
                          color: "var(--dark-green)",
                          marginBottom: "0",
                          lineHeight: "1",
                        }}
                      >
                        {(() => {
                          const depDT =
                            transport.departure_date_time ||
                            transport.departureDateTime;
                          if (depDT) {
                            return new Date(depDT).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            });
                          }
                          return "N/A";
                        })()}
                      </p>
                      <p
                        style={{
                          fontSize: "11px",
                          fontWeight: "500",
                          color: "#666",
                          marginTop: "2px",
                        }}
                      >
                        {(() => {
                          const depDT =
                            transport.departure_date_time ||
                            transport.departureDateTime;
                          if (depDT) {
                            return new Date(depDT).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            });
                          }
                          return "N/A";
                        })()}
                      </p>
                    </div>

                    <div
                      style={{
                        flex: 1,
                        textAlign: "center",
                        position: "relative",
                      }}
                    >
                      <div
                        style={{
                          height: "1px",
                          background: "#ddd",
                          margin: "0 15px",
                        }}
                      ></div>
                      <p
                        style={{
                          fontSize: "10px",
                          fontWeight: "600",
                          color: "#999",
                          marginTop: "4px",
                          textTransform: "uppercase",
                        }}
                      >
                        {(() => {
                          const depDT =
                            transport.departure_date_time ||
                            transport.departureDateTime;
                          const arrDT =
                            transport.arrival_date_time ||
                            transport.arrivalDateTime;
                          if (depDT && arrDT) {
                            try {
                              const departure = new Date(depDT);
                              const arrival = new Date(arrDT);
                              const diffMs = arrival - departure;
                              const diffMins = Math.floor(diffMs / 60000);
                              const hours = Math.floor(diffMins / 60);
                              const minutes = diffMins % 60;
                              return `${hours}h ${minutes}m`;
                            } catch (e) {
                              return "Duration";
                            }
                          }
                          return "Duration";
                        })()}
                      </p>
                    </div>

                    <div style={{ flex: 1, textAlign: "right" }}>
                      <p
                        style={{
                          fontSize: "20px",
                          fontWeight: "700",
                          color: "var(--dark-green)",
                          marginBottom: "0",
                          lineHeight: "1",
                        }}
                      >
                        {(() => {
                          const arrDT =
                            transport.arrival_date_time ||
                            transport.arrivalDateTime;
                          if (arrDT) {
                            return new Date(arrDT).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            });
                          }
                          return "N/A";
                        })()}
                      </p>
                      <p
                        style={{
                          fontSize: "11px",
                          fontWeight: "500",
                          color: "#666",
                          marginTop: "2px",
                        }}
                      >
                        {(() => {
                          const arrDT =
                            transport.arrival_date_time ||
                            transport.arrivalDateTime;
                          if (arrDT) {
                            return new Date(arrDT).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            });
                          }
                          return "N/A";
                        })()}
                      </p>
                    </div>
                  </div>

                  {/* Locations */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "10px",
                      paddingBottom: "8px",
                      borderBottom: "1px solid #eee",
                    }}
                  >
                    <p
                      style={{
                        fontSize: "11px",
                        fontWeight: "500",
                        color: "#666",
                        maxWidth: "48%",
                      }}
                    >
                      {transport.departureLocation || "N/A"}
                    </p>
                    <p style={{ color: "#ccc" }}>•</p>
                    <p
                      style={{
                        fontSize: "11px",
                        fontWeight: "500",
                        color: "#666",
                        maxWidth: "48%",
                        textAlign: "right",
                      }}
                    >
                      {transport.arrivalLocation || "N/A"}
                    </p>
                  </div>

                  {/* Travellers */}
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: "600",
                        textTransform: "uppercase",
                        color: "#999",
                        marginRight: "10px",
                      }}
                    >
                      {transport.transportType === "Bus" ||
                      transport.transportType === "Train"
                        ? "Travellers"
                        : "Passengers"}{" "}
                      ({transport.travelerNames?.length || 0}):
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: "500",
                        color: "var(--dark-green)",
                      }}
                    >
                      {transport.travelerNames?.length > 0
                        ? transport.travelerNames.join(", ")
                        : "N/A"}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ flex: 1 }}></div>
            <div className="footer-line"></div>
            <div className="footer">
              <span
                style={{ display: "flex", alignItems: "center", gap: "4px" }}
              >
                <WhatsAppIcon size={14} /> WhatsApp
              </span>
              <span>{agencySettings.whatsapp}</span>
              <span>{agencySettings.email}</span>
              <span>{agencySettings.website}</span>
            </div>
          </div>
        )}

      {/* INCLUSIONS & EXCLUSIONS */}
      <div className="page">
        <div
          className="orange-header-label secondary"
          style={{ padding: "10px 40px" }}
        >
          <h1>
            {tripInfo.duration || "0"} NIGHT{" "}
            {parseInt(tripInfo.duration || 0) + 1} DAYS
          </h1>
          <p>
            TRAVEL ITINERARY BY{" "}
            {(agencySettings.agencyName || "VIA KASHMIR").toUpperCase()}
          </p>
        </div>
        <div className="brand-logo-right" style={{ top: "10px" }}>
          {agencySettings.logo ? (
            <img
              src={formatImageUrl(agencySettings.logo)}
              alt="Logo"
              className="header-logo"
            />
          ) : (
            <>
              <h2>
                {(agencySettings.agencyName || "VIAKASHMIR").toUpperCase()}
              </h2>
              <span>TRAVEL SIMPLIFIED</span>
            </>
          )}
        </div>
        <div className="section-bar">
          <h2>INCLUSIONS/EXCLUSIONS</h2>
        </div>

        <div style={{ padding: "30px 60px" }}>
          <div style={{ marginBottom: "40px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "10px",
              }}
            >
              <h2
                style={{
                  color: "var(--dark-green)",
                  fontSize: "32px",
                  fontWeight: "900",
                }}
              >
                INCLUSIONS
              </h2>
              <div
                style={{
                  marginLeft: "15px",
                  display: "flex",
                  gap: "5px",
                  transform: "translateY(-10px)",
                }}
              >
                {[1, 2, 3].map((v) => (
                  <div
                    key={v}
                    style={{
                      width: "3px",
                      height: "15px",
                      background: "var(--primary-orange)",
                      transform: "rotate(20deg)",
                      borderRadius: "2px",
                    }}
                  ></div>
                ))}
              </div>
            </div>
            <div
              style={{
                height: "2px",
                background: "#e0e0e0",
                width: "100%",
                marginBottom: "15px",
              }}
            ></div>
            <ul style={{ listStyle: "none" }}>
              {inclusions.map((item, i) => (
                <li
                  key={`dyn-inc-${i}`}
                  style={{
                    marginBottom: "8px",
                    paddingLeft: "25px",
                    position: "relative",
                    fontSize: "16px",
                    fontWeight: "600",
                    color: "var(--dark-green)",
                    lineHeight: "1.2",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      left: 0,
                      top: "2px",
                      fontSize: "20px",
                      lineHeight: "1",
                    }}
                  >
                    •
                  </span>{" "}
                  {item.content}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "10px",
              }}
            >
              <h2
                style={{
                  color: "var(--dark-green)",
                  fontSize: "32px",
                  fontWeight: "900",
                }}
              >
                EXCLUSIONS
              </h2>
              <div
                style={{
                  marginLeft: "15px",
                  display: "flex",
                  gap: "5px",
                  transform: "translateY(-10px)",
                }}
              >
                {[1, 2, 3].map((v) => (
                  <div
                    key={v}
                    style={{
                      width: "3px",
                      height: "15px",
                      background: "var(--primary-orange)",
                      transform: "rotate(20deg)",
                      borderRadius: "2px",
                    }}
                  ></div>
                ))}
              </div>
            </div>
            <div
              style={{
                height: "2px",
                background: "#e0e0e0",
                width: "100%",
                marginBottom: "15px",
              }}
            ></div>
            <ul style={{ listStyle: "none" }}>
              {exclusions.map((item, i) => (
                <li
                  key={`dyn-exc-${i}`}
                  style={{
                    marginBottom: "8px",
                    paddingLeft: "25px",
                    position: "relative",
                    fontSize: "16px",
                    fontWeight: "600",
                    color: "var(--dark-green)",
                    lineHeight: "1.2",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      left: 0,
                      top: "2px",
                      fontSize: "20px",
                      lineHeight: "1",
                    }}
                  >
                    •
                  </span>{" "}
                  {item.content}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div style={{ flex: 1 }}></div>
        <div className="footer-line"></div>
        <div className="footer">
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <WhatsAppIcon size={14} /> WhatsApp
          </span>
          <span>{agencySettings.whatsapp}</span>
          <span>{agencySettings.email}</span>
          <span>{agencySettings.website}</span>
        </div>
      </div>

      {/* TERMS AND CONDITIONS */}
      <div className="page">
        <div
          className="orange-header-label secondary"
          style={{ padding: "10px 40px" }}
        >
          <h1 className="uppercase">
            {tripInfo.duration || "0"} NIGHT{" "}
            {parseInt(tripInfo.duration || 0) + 1} DAYS
          </h1>
          <p>
            TRAVEL ITINERARY BY{" "}
            {(agencySettings.agencyName || "VIA KASHMIR").toUpperCase()}
          </p>
        </div>
        <div className="brand-logo-right" style={{ top: "10px" }}>
          {agencySettings.logo ? (
            <img
              src={formatImageUrl(agencySettings.logo)}
              alt="Logo"
              className="header-logo"
            />
          ) : (
            <>
              <h2>
                {(agencySettings.agencyName || "VIAKASHMIR").toUpperCase()}
              </h2>
              <span>TRAVEL SIMPLIFIED</span>
            </>
          )}
        </div>
        <div className="section-bar">
          <h2>TERMS AND CONDITIONS</h2>
        </div>

        <div style={{ padding: "20px 60px", color: "var(--dark-green)" }}>
          <div style={{ marginBottom: "15px" }}>
            <h3
              style={{
                fontSize: "18px",
                fontWeight: "700",
                marginBottom: "8px",
              }}
            >
              Terms & Conditions
            </h3>
            <ul style={{ listStyle: "none" }}>
              {(Array.isArray(policies.termsConditions)
                ? policies.termsConditions
                : (policies.termsConditions || "").split("\n")
              )
                .filter((line) => line.trim())
                .map((item, i) => (
                  <li
                    key={i}
                    style={{
                      marginBottom: "4px",
                      paddingLeft: "15px",
                      position: "relative",
                      fontSize: "14px",
                      fontWeight: "500",
                      lineHeight: "1.3",
                    }}
                  >
                    <span style={{ position: "absolute", left: 0, top: "0" }}>
                      •
                    </span>{" "}
                    {item}
                  </li>
                ))}
            </ul>
          </div>

          <div style={{ marginBottom: "15px" }}>
            <h3
              style={{
                fontSize: "18px",
                fontWeight: "700",
                marginBottom: "8px",
              }}
            >
              Cancellation Policy
            </h3>
            <ul style={{ listStyle: "none" }}>
              {(Array.isArray(policies.cancellationPolicy)
                ? policies.cancellationPolicy
                : (policies.cancellationPolicy || "").split("\n")
              )
                .filter((line) => line.trim())
                .map((item, i) => (
                  <li
                    key={i}
                    style={{
                      marginBottom: "4px",
                      paddingLeft: "15px",
                      position: "relative",
                      fontSize: "14px",
                      fontWeight: "500",
                      lineHeight: "1.3",
                    }}
                  >
                    <span style={{ position: "absolute", left: 0, top: "0" }}>
                      •
                    </span>{" "}
                    {item}
                  </li>
                ))}
            </ul>
          </div>

          <div style={{ marginBottom: "10px" }}>
            <h3
              style={{
                fontSize: "18px",
                fontWeight: "700",
                marginBottom: "8px",
              }}
            >
              Additional Expenses (Indicative)
            </h3>
            <ul style={{ listStyle: "none" }}>
              {(Array.isArray(policies.additionalExpenses)
                ? policies.additionalExpenses
                : (policies.additionalExpenses || "").split("\n")
              )
                .filter((line) => line.trim())
                .map((item, i) => (
                  <li
                    key={i}
                    style={{
                      marginBottom: "4px",
                      paddingLeft: "15px",
                      position: "relative",
                      fontSize: "14px",
                      fontWeight: "500",
                      lineHeight: "1.3",
                    }}
                  >
                    <span style={{ position: "absolute", left: 0, top: "0" }}>
                      •
                    </span>{" "}
                    {item}
                  </li>
                ))}
            </ul>
          </div>

          <p style={{ fontSize: "14px", fontWeight: "600", marginTop: "10px" }}>
            Note: Government-fixed rates for activities will be shared
            separately.
          </p>
        </div>

        <div style={{ flex: 1 }}></div>
        <div className="footer-line"></div>
        <div className="footer">
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <WhatsAppIcon size={14} /> WhatsApp
          </span>
          <span>{agencySettings.whatsapp}</span>
          <span>{agencySettings.email}</span>
          <span>{agencySettings.website}</span>
        </div>
      </div>

      {/* MUST HAVES & ROLES */}
      <div className="page">
        <div
          className="orange-header-label secondary"
          style={{ padding: "10px 40px" }}
        >
          <h1 className="uppercase">
            {tripInfo.duration || "0"} NIGHT{" "}
            {parseInt(tripInfo.duration || 0) + 1} DAYS
          </h1>
          <p>
            TRAVEL ITINERARY BY{" "}
            {(agencySettings.agencyName || "VIA KASHMIR").toUpperCase()}
          </p>
        </div>
        <div className="brand-logo-right" style={{ top: "10px" }}>
          {agencySettings.logo ? (
            <img
              src={formatImageUrl(agencySettings.logo)}
              alt="Logo"
              className="header-logo"
            />
          ) : (
            <>
              <h2>
                {(agencySettings.agencyName || "VIAKASHMIR").toUpperCase()}
              </h2>
              <span>TRAVEL SIMPLIFIED</span>
            </>
          )}
        </div>

        <div className="section-bar">
          <h2>MUST HAVES</h2>
        </div>

        <div style={{ padding: "15px 60px" }}>
          <ul style={{ listStyle: "none" }}>
            {(Array.isArray(policies.mustHaves)
              ? policies.mustHaves
              : (policies.mustHaves || "").split("\n")
            )
              .filter((line) => line.trim())
              .map((item, i) => (
                <li
                  key={i}
                  style={{
                    marginBottom: "6px",
                    paddingLeft: "25px",
                    position: "relative",
                    fontSize: "15px",
                    fontWeight: "600",
                    color: "var(--dark-green)",
                    lineHeight: "1.2",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      left: 0,
                      top: "1px",
                      fontSize: "20px",
                      lineHeight: "1",
                    }}
                  >
                    •
                  </span>{" "}
                  {item}
                </li>
              ))}
          </ul>
        </div>

        <div className="section-bar">
          <h2>YOUR ROLES AND RESPONSIBILITIES</h2>
        </div>

        <div style={{ padding: "15px 60px" }}>
          <ul style={{ listStyle: "none" }}>
            {(Array.isArray(policies.rolesResponsibilities)
              ? policies.rolesResponsibilities
              : (policies.rolesResponsibilities || "").split("\n")
            )
              .filter((line) => line.trim())
              .map((item, i) => (
                <li
                  key={i}
                  style={{
                    marginBottom: "6px",
                    paddingLeft: "25px",
                    position: "relative",
                    fontSize: "15px",
                    fontWeight: "600",
                    color: "var(--dark-green)",
                    lineHeight: "1.2",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      left: 0,
                      top: "1px",
                      fontSize: "20px",
                      lineHeight: "1",
                    }}
                  >
                    •
                  </span>{" "}
                  {item}
                </li>
              ))}
          </ul>
        </div>

        <div style={{ padding: "0 60px", marginBottom: "20px" }}>
          <div
            style={{
              background: "#FDF5E6",
              borderRadius: "20px",
              padding: "20px",
              marginBottom: "15px",
            }}
          >
            <h3
              style={{
                fontSize: "18px",
                fontWeight: "700",
                color: "#0D2D2D",
                marginBottom: "8px",
              }}
            >
              Payment Details:
            </h3>
            <p
              style={{ fontSize: "15px", fontWeight: "800", color: "#0D2D2D" }}
            >
              Beneficiary Name:{" "}
              <span style={{ fontWeight: "900" }}>
                {agencySettings.beneficiaryName ||
                  "VIAKASHMIR OPC PRIVATE LIMITED"}
              </span>
            </p>
            <p
              style={{ fontSize: "15px", fontWeight: "800", color: "#0D2D2D" }}
            >
              Bank Name:{" "}
              <span style={{ fontWeight: "900" }}>
                {agencySettings.bankName || "N/A"}
              </span>
            </p>
            <p
              style={{ fontSize: "15px", fontWeight: "800", color: "#0D2D2D" }}
            >
              Account Number:{" "}
              <span style={{ fontWeight: "900" }}>
                {agencySettings.accountNumber || "0013619000005184"}
              </span>
            </p>
            <p
              style={{ fontSize: "15px", fontWeight: "800", color: "#0D2D2D" }}
            >
              IFSC CODE:{" "}
              <span style={{ fontWeight: "900" }}>
                {agencySettings.ifscCode || "YESB0000013"}
              </span>
            </p>
          </div>

          <div
            style={{
              background: "#FDF5E6",
              borderRadius: "20px",
              padding: "15px 30px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "10px",
                left: "350px",
                display: "flex",
                gap: "5px",
              }}
            >
              {[1, 2, 3].map((v) => (
                <div
                  key={v}
                  style={{
                    width: "2px",
                    height: "10px",
                    background: "var(--primary-orange)",
                    transform: "rotate(20deg)",
                    borderRadius: "2px",
                  }}
                ></div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <WhatsAppIcon size={32} style={{ color: "#25D366" }} />
              <div>
                <div
                  style={{
                    fontSize: "22px",
                    fontWeight: "800",
                    color: "#0D2D2D",
                  }}
                >
                  {agencySettings.whatsapp || "+91 9186051499"}
                </div>
                <div
                  style={{ fontSize: "12px", color: "#666", fontWeight: "600" }}
                >
                  WhatsApp Number
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: "12px",
                  color: "#666",
                  fontWeight: "600",
                  marginBottom: "2px",
                }}
              >
                Your Travel Partner
              </div>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "900",
                  color: "var(--dark-green)",
                }}
              >
                {agencySettings.logo ? (
                  <img
                    src={formatImageUrl(agencySettings.logo)}
                    alt="Logo"
                    className="header-logo"
                  />
                ) : (
                  (agencySettings.agencyName || "Via Kashmir").toUpperCase()
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1 }}></div>
        <div className="footer-line"></div>
        <div className="footer">
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <WhatsAppIcon size={14} /> WhatsApp
          </span>
          <span>{agencySettings.whatsapp}</span>
          <span>{agencySettings.email}</span>
          <span>{agencySettings.website}</span>
        </div>
      </div>

      {/* FINAL PAGE: THANK YOU */}
      <div
        className="page"
        style={{
          background: "var(--dark-green)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <h1
          style={{
            color: "white",
            fontSize: "72px",
            fontWeight: "900",
            letterSpacing: "2px",
            textAlign: "center",
          }}
        >
          THANK YOU!
        </h1>
        <div
          style={{
            marginTop: "20px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              color: "white",
              fontWeight: "600",
              letterSpacing: "5px",
              textTransform: "uppercase",
            }}
          >
            {(agencySettings.agencyName || "VIAKASHMIR").toUpperCase()}
          </p>
          {agencySettings.companyAddress?.trim() ? (
            <p
              style={{
                color: "white",
                marginTop: "10px",
                fontSize: "14px",
                fontWeight: "500",
                letterSpacing: "0.4px",
                textTransform: "none",
                opacity: 0.9,
              }}
            >
              {agencySettings.companyAddress}
            </p>
          ) : null}
        </div>

        <div
          style={{
            position: "absolute",
            bottom: "40px",
            left: "45px",
            right: "45px",
            color: "white",
            fontSize: "14px",
            fontWeight: "600",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "12px" }}>
            <span
              style={{
                background: "var(--primary-orange)",
                color: "var(--dark-green)",
                padding: "5px 15px",
                borderRadius: "20px",
                display: "inline-block",
              }}
            >
              Contact Us
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
            }}
          >
            <div style={{ width: "30%" }}>
              {agencySettings.logo && (
                <div
                  style={{
                    backgroundColor: "white",
                    padding: "4px 10px",
                    borderRadius: "12px",
                    display: "inline-block",
                    lineHeight: 0,
                  }}
                >
                  <img
                    src={formatImageUrl(agencySettings.logo)}
                    alt="Logo"
                    style={{
                      maxHeight: "80px",
                      maxWidth: "280px",
                      objectFit: "contain",
                    }}
                  />
                </div>
              )}
            </div>
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <WhatsAppIcon size={18} /> {agencySettings.whatsapp}
            </span>
            <span>🔗 {agencySettings.website}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModernTemplate;
