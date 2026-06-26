import React from "react";

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

const ClassicTemplate = ({
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

  const parseDateValue = (dateValue) => {
    if (!dateValue) return null;
    if (dateValue instanceof Date) {
      return isNaN(dateValue.getTime()) ? null : dateValue;
    }

    const raw = String(dateValue).trim();

    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      const parsed = new Date(Number(year), Number(month) - 1, Number(day));
      return isNaN(parsed.getTime()) ? null : parsed;
    }

    const dmyMatch = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (dmyMatch) {
      const [, day, month, year] = dmyMatch;
      const parsed = new Date(Number(year), Number(month) - 1, Number(day));
      return isNaN(parsed.getTime()) ? null : parsed;
    }

    const parsed = new Date(raw);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const d = parseDateValue(dateString);
    if (isNaN(d.getTime())) return "";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const primaryColor =
    agencySettings.primaryColor || agencySettings.brandColor || "#FAA61A";
  const secondaryColor = agencySettings.secondaryColor || "#0B7AAC";
  const fontFamily = agencySettings.font_family || "Montserrat";

  // Sort and group transportation
  const sortedTransportation = [...transportation].sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(a.date) - new Date(b.date);
  });

  const uniqueTransportDates = [
    ...new Set(sortedTransportation.map((t) => t.date).filter(Boolean)),
  ].sort((a, b) => new Date(a) - new Date(b));

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

  // Calculate trip end date
  const calculateEndDate = () => {
    if (!tripInfo.startDate || !tripInfo.duration) return "";
    const start = parseDateValue(tripInfo.startDate);
    if (!start) return "";
    const end = new Date(start);
    end.setDate(start.getDate() + parseInt(tripInfo.duration || 0));
    return formatDate(end);
  };

  const startDateFormatted = tripInfo.startDate
    ? formatDate(tripInfo.startDate)
    : "";

  // Get first 3 itinerary items for highlights
  const highlights = itinerary.slice(0, 3);

  const ClassicFooter = ({ light = false }) => (
    <div
      style={{
        position: "absolute",
        bottom: "30px",
        left: "50px",
        right: "50px",
        fontSize: "12px",
        opacity: light ? "0.8" : "1",
        color: light ? "white" : "#666",
        borderTop: light ? "1px solid rgba(255,255,255,0.2)" : "1px solid #eee",
        paddingTop: "12px",
      }}
    >
      {light ? (
        <>
          <div style={{ textAlign: "center", marginBottom: "12px" }}>
            <span
              style={{
                background: primaryColor,
                color: secondaryColor,
                padding: "5px 15px",
                borderRadius: "20px",
                display: "inline-block",
                fontWeight: "800",
                textTransform: "uppercase",
                fontSize: "11px",
              }}
            >
              Contact Us
            </span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <div style={{ width: "30%" }}>
              {agencySettings.logo && (
                <img
                  src={formatImageUrl(agencySettings.logo)}
                  alt="Logo"
                  style={{
                    maxHeight: "80px",
                    maxWidth: "280px",
                    objectFit: "contain",
                  }}
                />
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <WhatsAppIcon size={16} /> {agencySettings.whatsapp || "N/A"}
            </div>
            <div>{agencySettings.website || "www.viaitinerary.com"}</div>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <WhatsAppIcon size={16} /> {agencySettings.whatsapp || "N/A"}
          </div>
          <div style={{ fontWeight: "600" }}>
            {agencySettings.agencyName || "VIAITINERARY"}
          </div>
          <div>{agencySettings.website || "www.viaitinerary.com"}</div>
        </>
      )}
    </div>
  );

  return (
    <div
      id="print-content-classic"
      className="classic-template-wrapper bg-white"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=${fontFamily.replace(/\s+/g, "+")}:wght@300;400;500;600;700;800;900&display=swap');
        
        .classic-template-wrapper * { 
          margin: 0; 
          padding: 0; 
          box-sizing: border-box; 
          font-family: '${fontFamily}', 'Arial', sans-serif; 
        }

        .classic-page {
          width: 210mm;
          min-height: 297mm;
          height: 297mm;
          margin: 40px auto;
          background: white;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 0 20px rgba(0,0,0,0.1);
          page-break-after: always;
          page-break-inside: avoid;
        }

        @media print {
          .classic-template-wrapper { background: none; padding: 0; }
          .classic-page { 
            margin: 0 !important; 
            box-shadow: none !important; 
            page-break-after: always !important; 
            height: 297mm !important;
            width: 210mm !important;
          }
          .classic-page:last-child { page-break-after: avoid !important; }
        }

        /* Header with Image */
        .classic-hero {
          position: relative;
          height: 500px;
          background-size: cover;
          background-position: center;
          display: flex;
          align-items: flex-end;
          padding-bottom: 40px;
        }

        .classic-hero::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.4);
        }

        .classic-hero-content {
          position: relative;
          z-index: 2;
          text-align: center;
          color: white;
          padding: 0 60px;
          width: 100%;
        }

        .classic-title {
          font-size: 72px;
          font-weight: 800;
          color: ${primaryColor};
          text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
          margin-bottom: 10px;
          font-family: ${fontFamily}, sans-serif;
        }

        .classic-subtitle {
          font-size: 32px;
          font-weight: 300;
          color: white;
          font-family: ${fontFamily}, sans-serif;
        }

        /* Destination Banner */
        .classic-destination-banner {
          background: ${secondaryColor};
          color: white;
          display: flex;
          align-items: center;
          padding: 20px 50px;
          gap: 40px;
        }

        .classic-destination-item {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .classic-destination-icon {
          width: 32px;
          height: 32px;
          background: ${primaryColor};
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .classic-destination-text {
          font-size: 15px;
          font-weight: 700;
        }

        .classic-destination-label {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .classic-destination-value {
          font-size: 14px;
          font-weight: 800;
        }

        /* Section Headers */
        .classic-section-header {
          background: ${primaryColor};
          padding: 15px 50px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin: 40px 0 30px;
        }

        .classic-section-left {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .classic-section-icon {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .classic-section-title {
          font-size: 32px;
          font-weight: 700;
          color: white;
        }

        .classic-section-logo {
          height: 80px;
          max-width: 280px;
          object-fit: contain;
          display: inline-block;
        }

        /* Trip Highlights */
        .classic-highlights {
          padding: 40px 50px;
        }

        .classic-highlights-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
        }

        .classic-highlights-title {
          font-size: 32px;
          font-weight: 700;
          color: ${secondaryColor};
        }

        .classic-budget {
          text-align: right;
        }

        .classic-budget-label {
          font-size: 24px;
          font-weight: 700;
          color: ${secondaryColor};
        }

        .classic-budget-value {
          font-size: 18px;
          font-weight: 600;
          color: #333;
        }

        .classic-highlights-grid {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-start;
          gap: 25px;
        }

        .classic-highlight-card {
          text-align: left;
          width: 190px;
        }

        .classic-highlight-image {
          width: 100%;
          height: 200px;
          object-fit: cover;
          border-radius: 15px;
          margin-bottom: 15px;
        }

        .classic-highlight-title {
          font-size: 18px;
          font-weight: 700;
          color: ${secondaryColor};
        }

        /* Tables */
        .classic-table-container {
          padding: 0 50px 40px;
        }

        .classic-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
          table-layout: fixed;
        }

        .classic-table thead {
          background: ${secondaryColor};
          color: white;
        }

        .classic-table th {
          padding: 12px 10px;
          text-align: left;
          font-size: 13px;
          font-weight: 700;
          border: none;
          word-wrap: break-word;
        }

        .classic-table td {
          padding: 10px 10px;
          border: 1px solid #E0E0E0;
          font-size: 12px;
          font-weight: 500;
          color: #333;
          word-wrap: break-word;
        }

        .classic-table tbody tr:nth-child(even) {
          background: #F8F8F8;
        }

        /* Hotel Cards */
        .classic-hotel-cards {
          padding: 0 50px 40px;
        }

        .classic-hotel-card {
          display: flex;
          gap: 30px;
          margin-bottom: 30px;
          align-items: center;
          padding: 20px;
          background: #F8F8F8;
          border-radius: 12px;
          border: 1px solid #EEE;
        }

        .classic-hotel-image {
          width: 280px;
          height: 180px;
          object-fit: cover;
          border-radius: 12px;
          flex-shrink: 0;
        }

        .classic-hotel-info {
          flex: 1;
        }

        .classic-hotel-name {
          font-size: 22px;
          font-weight: 700;
          color: ${secondaryColor};
          margin-bottom: 8px;
        }

        .classic-hotel-desc {
          font-size: 14px;
          font-weight: 400;
          color: #666;
          line-height: 1.6;
        }

        /* Itinerary Cards */
        .classic-itinerary-grid {
          padding: 0 50px 40px;
          display: grid;
          grid-template-columns: 1fr;
          grid-auto-rows: min-content;
          gap: 20px;
        }

        .classic-day-card {
          background: #FEF9E7;
          border-radius: 15px;
          padding: 15px 25px;
          height: fit-content;
          align-self: start;
        }

        .classic-day-title {
          font-size: 20px;
          font-weight: 700;
          color: ${secondaryColor};
          margin-bottom: 10px;
        }

        .classic-day-checklist {
          list-style: none;
          padding: 0;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0 30px;
        }

        .classic-day-checklist li {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 8px;
          font-size: 14px;
          font-weight: 500;
          color: #333;
          line-height: 1.4;
        }

        .classic-checkbox {
          width: 18px;
          height: 18px;
          border: 2px solid ${secondaryColor};
          border-radius: 4px;
          flex-shrink: 0;
          margin-top: 2px;
        }

        /* Inclusion/Exclusion Table */
        .classic-checklist-table {
          width: 100%;
          border-collapse: collapse;
        }

        .classic-checklist-table thead {
          background: ${secondaryColor};
          color: white;
        }

        .classic-checklist-table th {
          padding: 18px 20px;
          text-align: left;
          font-size: 16px;
          font-weight: 700;
        }

        .classic-checklist-table td {
          padding: 16px 20px;
          border: 1px solid #E0E0E0;
          font-size: 15px;
          font-weight: 500;
          color: #333;
        }

        .classic-checklist-table td:last-child {
          text-align: center;
          width: 120px;
        }

          .classic-template-wrapper { background: none; padding: 0; }
          .classic-page { margin: 0; box-shadow: none; page-break-after: always; }
          .classic-page:last-child { page-break-after: avoid; }
        }
      `,
        }}
      />

      {/* PAGE 1: Cover with Trip Highlights */}
      <div className="classic-page">
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            background: primaryColor,
            color: "white",
            padding: "15px 60px 15px 40px",
            display: "inline-block",
            width: "auto",
            minWidth: "250px",
            maxWidth: "550px",
            borderBottomRightRadius: "40px",
            zIndex: 10,
          }}
        >
          {agencySettings.logo ? (
            <img
              src={formatImageUrl(agencySettings.logo)}
              alt="Logo"
              style={{
                maxHeight: "80px",
                maxWidth: "280px",
                objectFit: "contain",
                display: "inline-block",
              }}
            />
          ) : (
            <>
              <h1
                style={{
                  fontSize: "24px",
                  fontWeight: "800",
                  letterSpacing: "1px",
                  whiteSpace: "nowrap",
                }}
              >
                {(agencySettings.agencyName || "VIAITINERARY").toUpperCase()}
              </h1>
              <p
                style={{
                  fontSize: "10px",
                  fontWeight: "600",
                  letterSpacing: "1.5px",
                  opacity: 0.8,
                  whiteSpace: "nowrap",
                }}
              >
                TRAVEL SIMPLIFIED
              </p>
            </>
          )}
        </div>
        <div
          className="classic-hero"
          style={{
            backgroundImage: `url(${
              formatImageUrl(tripInfo.image) ||
              "https://images.unsplash.com/photo-1490806843957-31f4c9a91c65?auto=format&fit=crop&q=80&w=2000"
            })`,
          }}
        >
          <div className="classic-hero-content" style={{ flex: 1 }}>
            <h1
              style={{
                fontSize: "68px",
                fontWeight: "900",
                lineHeight: "0.9",
                textTransform: "uppercase",
                color: primaryColor,
                textShadow: "0 4px 10px rgba(0,0,0,0.3)",
                marginBottom: "10px",
              }}
            >
              {tripInfo.duration || "0"} NIGHTS{" "}
              {parseInt(tripInfo.duration || 0) + 1} DAYS
            </h1>
            <p
              style={{
                fontSize: "16px",
                letterSpacing: "4px",
                fontWeight: "600",
                textTransform: "uppercase",
              }}
            >
              TRAVEL ITINERARY BY{" "}
              {(agencySettings.agencyName || "VIAITINERARY").toUpperCase()}
            </p>
          </div>
        </div>

        <div className="classic-destination-banner">
          <div className="classic-destination-item">
            <div className="classic-destination-icon">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <div>
              <div className="classic-destination-label">Destination</div>
              <div className="classic-destination-value">
                {tripInfo.destination || "Adventure Awaits"}
              </div>
            </div>
          </div>
          <div
            className="classic-destination-item"
            style={{ marginLeft: "auto" }}
          >
            <div>
              <div className="classic-destination-label">Trip ID</div>
              <div className="classic-destination-value">
                {tripInfo.tripId ? `#${tripInfo.tripId}` : "—"}
              </div>
            </div>
          </div>
          <div
            className="classic-destination-item"
            style={{ marginLeft: "20px" }}
          >
            <div>
              <div className="classic-destination-label">Pax</div>
              <div className="classic-destination-value">
                {tripInfo.adults ? `${tripInfo.adults} Adults` : "2 Adults"}
                {Number(tripInfo.kidsUpto5 || 0) +
                  Number(tripInfo.kids5to12 || 0) >
                0
                  ? `, ${Number(tripInfo.kidsUpto5 || 0) + Number(tripInfo.kids5to12 || 0)} Kids`
                  : ""}
              </div>
            </div>
          </div>
          <div
            className="classic-destination-item"
            style={{ marginLeft: "auto" }}
          >
            <div>
              <div className="classic-destination-label">Start Date</div>
              <div className="classic-destination-value">
                {startDateFormatted || "Not Set"}
              </div>
            </div>
          </div>
        </div>

        <div className="classic-highlights">
          <div className="classic-highlights-header">
            <div className="classic-highlights-title">Greetings!</div>
          </div>
          <div style={{ paddingRight: "100px" }}>
            <p
              style={{
                fontSize: "18px",
                color: "#333",
                fontWeight: "700",
                marginBottom: "10px",
              }}
            >
              Dear {tripInfo.clientName || "Guest"},
            </p>
            <p
              style={{
                fontSize: "15px",
                color: "#666",
                lineHeight: "1.6",
                marginBottom: "30px",
              }}
            >
              {(
                agencySettings.greetingMessage ||
                "Greetings from {agencyName}. Our team has put up this Quote regarding your upcoming trip. Please review it and let us know if you would like any changes."
              ).replace(
                /{agencyName}/g,
                (agencySettings.agencyName || "VIAITINERARY").toUpperCase(),
              )}
            </p>

            <div
              style={{
                background: "#f9f9f9",
                borderLeft: `5px solid ${secondaryColor}`,
                padding: "25px",
                borderRadius: "15px",
                display: "inline-block",
                minWidth: "300px",
                boxShadow: "0 4px 15px rgba(0,0,0,0.05)",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  color: "#666",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  marginBottom: "5px",
                  fontWeight: "600",
                }}
              >
                Quote Price
              </div>
              <div
                style={{
                  fontSize: "32px",
                  fontWeight: "800",
                  color: secondaryColor,
                  display: "flex",
                  alignItems: "baseline",
                  gap: "5px",
                }}
              >
                <span style={{ fontSize: "18px" }}>
                  {tripInfo.currency?.replace(/\s*\(.*?\)\s*/g, "") || "INR"}
                </span>
                {Number(tripInfo.cost || 0).toLocaleString()}/-
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "#888",
                  fontStyle: "italic",
                  marginTop: "5px",
                  textAlign: "right",
                }}
              >
                {includeGST ? "including GST/-" : "excluding GST/-"}
              </div>
            </div>
          </div>
        </div>
        <ClassicFooter />
      </div>

      {/* Trip Highlights Page(s) */}
      {Array.from({
        length: Math.ceil((itinerary || []).length / 6),
      }).map((_, pageIdx) => (
        <div key={`highlights-page-${pageIdx}`} className="classic-page">
          <div className="classic-section-header">
            <div className="classic-section-left">
              <div className="classic-section-title">Trip Highlights</div>
            </div>
            {agencySettings.logo && (
              <img
                src={formatImageUrl(agencySettings.logo)}
                alt="Logo"
                className="classic-section-logo"
              />
            )}
          </div>

          <div className="classic-highlights" style={{ flex: 1 }}>
            <div
              className="classic-highlights-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "40px",
                justifyContent: "start",
              }}
            >
              {(itinerary || [])
                .slice(pageIdx * 6, pageIdx * 6 + 6)
                .map((item, index) => (
                  <div
                    key={index}
                    className="classic-highlight-card"
                    style={{ marginBottom: "20px" }}
                  >
                    <img
                      src={
                        formatImageUrl(item.photo) ||
                        "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&q=80&w=400"
                      }
                      alt={item.title}
                      className="classic-highlight-image"
                      style={{ height: "160px" }}
                    />
                    <div
                      className="classic-highlight-title"
                      style={{ fontSize: "14px" }}
                    >
                      {item.title.replace(/^Day \d+:\s*/i, "")}
                    </div>
                  </div>
                ))}
            </div>
          </div>
          <ClassicFooter />
        </div>
      ))}

      {/* PAGE 2: Accommodation Info */}
      {(() => {
        if (!accommodations || accommodations.length === 0) {
          return (
            <div className="classic-page">
              <div className="classic-section-header">
                <div className="classic-section-left">
                  <div className="classic-section-title">Accommodation</div>
                </div>
                {agencySettings.logo && (
                  <img
                    src={formatImageUrl(agencySettings.logo)}
                    alt="Logo"
                    className="classic-section-logo"
                  />
                )}
              </div>
              <div
                style={{ padding: "60px", textAlign: "center", color: "#666" }}
              >
                <h3
                  style={{
                    fontSize: "24px",
                    fontWeight: "800",
                    color: secondaryColor,
                  }}
                >
                  HOTEL BOOKED BY GUEST
                </h3>
                <p style={{ marginTop: "10px" }}>
                  No accommodation details have been added to this quote.
                </p>
              </div>
              <ClassicFooter />
            </div>
          );
        }

        const hotelsPerPage = 3;

        // Group accommodations by Hotel Name, City, Category, and Room Type
        const groupedAccommodationList = [];
        if (accommodations && accommodations.length > 0) {
          const sorted = [...accommodations].sort((a, b) => {
            if (!a.checkIn) return 1;
            if (!b.checkIn) return -1;
            return new Date(a.checkIn) - new Date(b.checkIn);
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
            } else {
              groupedAccommodationList.push({
                ...hotel,
                allDates: [
                  { checkIn: hotel.checkIn, checkOut: hotel.checkOut },
                ],
              });
            }
          });
        }

        const hotelChunks = [];
        for (
          let i = 0;
          i < groupedAccommodationList.length;
          i += hotelsPerPage
        ) {
          hotelChunks.push(
            groupedAccommodationList.slice(i, i + hotelsPerPage),
          );
        }

        return (
          <>
            {/* Page 1: Summary Table Only */}
            <div className="classic-page">
              <div className="classic-section-header">
                <div className="classic-section-left">
                  <div className="classic-section-title">Accommodation</div>
                </div>
                {agencySettings.logo && (
                  <img
                    src={formatImageUrl(agencySettings.logo)}
                    alt="Logo"
                    className="classic-section-logo"
                  />
                )}
              </div>

              <div style={{ flex: 1 }}>
                {/* Full Table on Page 1 */}
                <div className="classic-table-container">
                  <table className="classic-table">
                    <thead>
                      <tr>
                        <th>City</th>
                        <th>Hotel</th>
                        <th>Room Type</th>
                        <th>Rooms</th>
                        <th>Extra Beds</th>
                        <th>Meal Plan</th>
                        <th>Nights</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedAccommodationList.map((hotel, index) => (
                        <tr key={index}>
                          <td>{hotel.city || "-"}</td>
                          <td>{hotel.name || "-"}</td>
                          <td>{hotel.roomType || "-"}</td>
                          <td>{hotel.rooms || "-"}</td>
                          <td>{getTotalExtraBeds(hotel) || "-"}</td>
                          <td>{hotel.mealPlan || "-"}</td>
                          <td>
                            {hotel.allDates
                              ? hotel.allDates.reduce((acc, dateObj) => {
                                  if (dateObj.checkIn && dateObj.checkOut) {
                                    const cIn = parseDateValue(dateObj.checkIn);
                                    const cOut = parseDateValue(
                                      dateObj.checkOut,
                                    );
                                    if (cIn && cOut) {
                                      const diffTime = Math.abs(
                                        cOut.getTime() - cIn.getTime(),
                                      );
                                      const diffDays = Math.ceil(
                                        diffTime / (1000 * 60 * 60 * 24),
                                      );
                                      return (
                                        acc + (diffDays > 0 ? diffDays : 1)
                                      );
                                    }
                                  }
                                  return acc + 1;
                                }, 0)
                              : 1}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <ClassicFooter />
            </div>

            {/* Subsequent Pages: Hotel Cards ONLY */}
            {(() => {
              return hotelChunks.map((chunk, pageIndex) => (
                <div
                  className="classic-page"
                  key={`hotel-page-${pageIndex + 2}`}
                >
                  <div className="classic-section-header">
                    <div className="classic-section-left">
                      <div className="classic-section-title">Accommodation</div>
                    </div>
                    {agencySettings.logo && (
                      <img
                        src={formatImageUrl(agencySettings.logo)}
                        alt="Logo"
                        className="classic-section-logo"
                      />
                    )}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div className="classic-hotel-cards">
                      {chunk.map((hotel, index) => {
                        const getOrdinal = (n) => {
                          const s = ["th", "st", "nd", "rd"];
                          const v = n % 100;
                          return n + (s[(v - 20) % 10] || s[v] || s[0]);
                        };

                        let dayBadge = "";
                        if (hotel.allDates) {
                          const stayGroups = hotel.allDates
                            .sort(
                              (a, b) =>
                                new Date(a.checkIn) - new Date(b.checkIn),
                            )
                            .map((dateObj) => {
                              const checkInDate = dateObj.checkIn;
                              const checkOutDate = dateObj.checkOut;

                              const startDayNum = tripInfo.startDate
                                ? Math.floor(
                                    (new Date(checkInDate) -
                                      new Date(tripInfo.startDate)) /
                                      (1000 * 60 * 60 * 24),
                                  ) + 1
                                : 1;

                              let stayNights = 1;
                              if (checkInDate && checkOutDate) {
                                const cIn = parseDateValue(checkInDate);
                                const cOut = parseDateValue(checkOutDate);
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

                              const daysInThisStay = [];
                              for (let i = 0; i < stayNights; i++) {
                                daysInThisStay.push(
                                  getOrdinal(startDayNum + i),
                                );
                              }

                              if (daysInThisStay.length > 2) {
                                const last = daysInThisStay.pop();
                                return `${daysInThisStay.join(", ")} & ${last}`;
                              } else if (daysInThisStay.length === 2) {
                                return `${daysInThisStay[0]} & ${daysInThisStay[1]}`;
                              } else {
                                return daysInThisStay[0];
                              }
                            });

                          if (stayGroups.length > 2) {
                            const last = stayGroups.pop();
                            dayBadge = `${stayGroups.join(", ")} & ${last} Day`;
                          } else if (stayGroups.length === 2) {
                            dayBadge = `${stayGroups[0]} & ${stayGroups[1]} Day`;
                          } else {
                            dayBadge = stayGroups[0] + " Day";
                          }
                        } else {
                          dayBadge = "Accommodation";
                        }

                        const totalExtraBeds = getTotalExtraBeds(hotel);

                        return (
                          <div key={index} className="classic-hotel-card">
                            <img
                              src={
                                formatImageUrl(hotel.photo) ||
                                "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=400"
                              }
                              alt={hotel.name}
                              className="classic-hotel-image"
                            />
                            <div className="classic-hotel-info">
                              <div className="classic-hotel-name">
                                {hotel.name || "Hotel"}, {hotel.city || "City"}
                              </div>
                              <div
                                className="stars"
                                style={{
                                  color: "#FAA61A",
                                  display: "flex",
                                  gap: "2px",
                                  marginBottom: "8px",
                                }}
                              >
                                {"★"
                                  .repeat(parseInt(hotel.category || 0))
                                  .padEnd(5, "☆")}
                              </div>
                              <div className="classic-hotel-desc">
                                <div
                                  style={{
                                    color: secondaryColor,
                                    fontWeight: "700",
                                    fontSize: "13px",
                                    letterSpacing: "0.5px",
                                    marginBottom: "4px",
                                    textTransform: "uppercase",
                                  }}
                                >
                                  {dayBadge}
                                </div>
                                <div
                                  style={{
                                    fontSize: "14px",
                                    lineHeight: "1.6",
                                    color: "#666",
                                  }}
                                >
                                  {hotel.rooms && (
                                    <span>{hotel.rooms} Rooms • </span>
                                  )}
                                  {hotel.roomType && (
                                    <span>{hotel.roomType}</span>
                                  )}
                                  {totalExtraBeds > 0 && (
                                    <span>
                                      {hotel.roomType ? " • " : ""}
                                      {totalExtraBeds} Extra Beds
                                    </span>
                                  )}
                                  {hotel.mealPlan && (
                                    <span>
                                      {hotel.roomType || totalExtraBeds > 0
                                        ? " • "
                                        : ""}
                                      {hotel.mealPlan}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <ClassicFooter />
                </div>
              ));
            })()}
          </>
        );
      })()}

      {/* PAGE 3: Transportation Info */}
      <div className="classic-page">
        <div className="classic-section-header">
          <div className="classic-section-left">
            <div className="classic-section-title">Transportation Info</div>
          </div>
          {agencySettings.logo && (
            <img
              src={formatImageUrl(agencySettings.logo)}
              alt="Logo"
              className="classic-section-logo"
            />
          )}
        </div>

        {transportation.length > 0 ? (
          <div className="classic-table-container" style={{ flex: 1 }}>
            <table className="classic-table">
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
                {sortedTransportation.map((transport, index) => {
                  const dayNum = transport.date
                    ? uniqueTransportDates.indexOf(transport.date) + 1
                    : index + 1;
                  const suffixes = ["st", "nd", "rd"];
                  const suffix =
                    dayNum % 10 < 4 &&
                    dayNum % 10 > 0 &&
                    (dayNum % 100 < 10 || dayNum % 100 > 20)
                      ? suffixes[(dayNum % 10) - 1]
                      : "th";
                  const dayLabel = dayNum + suffix + " Day";

                  return (
                    <tr key={index}>
                      <td style={{ fontSize: "11px" }}>
                        {dayLabel}
                        {transport.date && (
                          <div
                            style={{
                              fontSize: "9px",
                              color: "#888",
                              marginTop: "2px",
                            }}
                          >
                            ({formatDate(transport.date)})
                          </div>
                        )}
                      </td>
                      <td
                        style={{
                          textTransform: "uppercase",
                          fontSize: "10px",
                          fontWeight: "800",
                          color: "#666",
                        }}
                      >
                        {transport.tripType || "Transfer"}
                      </td>
                      <td>{transport.route || "-"}</td>
                      <td
                        style={{
                          fontWeight: "700",
                          color: "#000000",
                        }}
                      >
                        {transport.quantity || "1"}
                      </td>
                      <td>{transport.vehicleType || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: "60px", textAlign: "center", color: "#666" }}>
            <h3
              style={{
                fontSize: "24px",
                fontWeight: "800",
                color: secondaryColor,
              }}
            >
              TRANSPORT BOOKED BY GUEST
            </h3>
            <p style={{ marginTop: "10px" }}>
              No transportation details have been added to this quote.
            </p>
          </div>
        )}
        <ClassicFooter />
      </div>

      {/* PAGE 4-5: Day-by-Day Itinerary */}
      {itinerary.length > 0 &&
      itinerary.some(
        (day) =>
          day.description?.trim() ||
          (day.title && !day.title.toLowerCase().startsWith("day ")),
      ) ? (
        <>
          {Array.from({
            length: Math.ceil(
              itinerary.filter(
                (day) =>
                  day.description?.trim() ||
                  (day.title && !day.title.toLowerCase().startsWith("day ")),
              ).length / 2,
            ),
          }).map((_, pageIndex) => (
            <div key={`itinerary-page-${pageIndex}`} className="classic-page">
              <div
                className="classic-section-header"
                style={{ marginTop: "0", marginBottom: "30px" }}
              >
                <div className="classic-section-left">
                  <div className="classic-section-title">Daily Itinerary</div>
                </div>
                {agencySettings.logo && (
                  <img
                    src={formatImageUrl(agencySettings.logo)}
                    alt="Logo"
                    className="classic-section-logo"
                  />
                )}
              </div>
              <div className="classic-itinerary-grid" style={{ flex: 1 }}>
                {itinerary
                  .filter(
                    (day) =>
                      day.description?.trim() ||
                      (day.title &&
                        !day.title.toLowerCase().startsWith("day ")),
                  )
                  .slice(pageIndex * 2, pageIndex * 2 + 2)
                  .map((day, index) => (
                    <div key={index} className="classic-day-card">
                      <div className="classic-day-title">
                        Day {day.day}
                        {(() => {
                          const transport = transportation[day.day - 1];
                          return transport && transport.route
                            ? ` : ${transport.route}`
                            : "";
                        })()}
                      </div>
                      <ul
                        className="classic-day-checklist"
                        style={{ gridTemplateColumns: "1fr" }}
                      >
                        {day.description
                          ?.split("\n")
                          .filter((line) => line.trim())
                          .slice(0, 5)
                          .map((item, i) => (
                            <li key={i}>
                              <div className="classic-checkbox"></div>
                              <span>{item.replace(/^[-•*]\s*/, "")}</span>
                            </li>
                          )) || (
                          <li>
                            <div className="classic-checkbox"></div>
                            <span>
                              {day.title.replace(/^Day \d+:\s*/i, "")}
                            </span>
                          </li>
                        )}
                      </ul>
                    </div>
                  ))}
              </div>
              <ClassicFooter />
            </div>
          ))}
        </>
      ) : (
        <div className="classic-page">
          <div
            className="classic-section-header"
            style={{ marginTop: "0", marginBottom: "30px" }}
          >
            <div className="classic-section-left">
              <div className="classic-section-title">Daily Itinerary</div>
            </div>
            {agencySettings.logo && (
              <img
                src={formatImageUrl(agencySettings.logo)}
                alt="Logo"
                className="classic-section-logo"
              />
            )}
          </div>
          <div style={{ flex: 1, padding: "60px", textAlign: "center" }}>
            <div
              style={{
                background: "#F9F9F9",
                borderRadius: "15px",
                padding: "40px",
                border: "1px dashed #DDD",
              }}
            >
              <h3
                style={{
                  fontSize: "24px",
                  fontWeight: "800",
                  color: secondaryColor,
                }}
              >
                ITINERARY PENDING
              </h3>
              <p style={{ marginTop: "10px", color: "#666" }}>
                No daily itinerary details have been added to this quote yet.
              </p>
            </div>
          </div>
          <ClassicFooter />
        </div>
      )}

      {/* TRANSPORTATION INFORMATION PAGE */}
      {tripInfo.useFlight &&
        tripInfo.transportDetails &&
        tripInfo.transportDetails.length > 0 && (
          <div className="classic-page">
            <div
              className="classic-section-header"
              style={{ marginTop: "0", marginBottom: "30px" }}
            >
              <div className="classic-section-left">
                <div className="classic-section-title">Transport Info</div>
              </div>
              {agencySettings.logo && (
                <img
                  src={formatImageUrl(agencySettings.logo)}
                  alt="Logo"
                  className="classic-section-logo"
                />
              )}
            </div>

            <div className="classic-table-container" style={{ flex: 1 }}>
              {tripInfo.transportDetails.map((transport, tIndex) => (
                <div
                  key={`transport-${tIndex}`}
                  style={{
                    background: "#f8f9fa",
                    borderRadius: "16px",
                    padding: "15px 25px",
                    border: "1px solid #eee",
                    color: secondaryColor,
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
                      style={{
                        fontSize: "14px",
                        color: secondaryColor,
                      }}
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
                          color: secondaryColor,
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
                          color: secondaryColor,
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
                          color: secondaryColor,
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
                        color: secondaryColor,
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
            <ClassicFooter />
          </div>
        )}

      {/* PAGE 6: Inclusion/Exclusion */}
      <div className="classic-page">
        <div className="classic-section-header">
          <div className="classic-section-left">
            <div className="classic-section-title">Inclusion/Exclusion</div>
          </div>
          {agencySettings.logo && (
            <img
              src={formatImageUrl(agencySettings.logo)}
              alt="Logo"
              className="classic-section-logo"
            />
          )}
        </div>

        <div className="classic-table-container">
          <div style={{ flex: 1 }}>
            {inclusions.length > 0 ? (
              <table
                className="classic-checklist-table"
                style={{ marginBottom: "40px" }}
              >
                <thead>
                  <tr>
                    <th>Inclusions</th>
                    <th>Checklist</th>
                  </tr>
                </thead>
                <tbody>
                  {inclusions.map((item, index) => (
                    <tr key={`inclusion-${index}`}>
                      <td>{item.content || item}</td>
                      <td style={{ textAlign: "center" }}>
                        <div
                          className="classic-checkbox"
                          style={{ margin: "0 auto" }}
                        ></div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div
                style={{
                  marginBottom: "40px",
                  padding: "20px",
                  textAlign: "center",
                  color: "#666",
                  border: "1px dashed #ccc",
                }}
              >
                No inclusion details added.
              </div>
            )}

            {exclusions.length > 0 ? (
              <table className="classic-checklist-table">
                <thead>
                  <tr>
                    <th>Exclusions</th>
                    <th>Checklist</th>
                  </tr>
                </thead>
                <tbody>
                  {exclusions.map((item, index) => (
                    <tr key={`exclusion-${index}`}>
                      <td>{item.content || item}</td>
                      <td style={{ textAlign: "center" }}>
                        <div
                          className="classic-checkbox"
                          style={{ margin: "0 auto" }}
                        ></div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div
                style={{
                  padding: "20px",
                  textAlign: "center",
                  color: "#666",
                  border: "1px dashed #ccc",
                }}
              >
                No exclusion details added.
              </div>
            )}
          </div>
        </div>
        <ClassicFooter />
      </div>

      {/* PAGE 7: Policies Section */}
      {Object.values(policies).some((p) => p) && (
        <div className="classic-page">
          <div className="classic-section-header" style={{ marginTop: "0" }}>
            <div className="classic-section-left">
              <div className="classic-section-title">Policies</div>
            </div>
            {agencySettings.logo && (
              <img
                src={formatImageUrl(agencySettings.logo)}
                alt="Logo"
                className="classic-section-logo"
              />
            )}
          </div>

          <div className="classic-table-container" style={{ flex: 1 }}>
            {/* Terms & Conditions */}
            {policies.termsConditions && (
              <div style={{ marginBottom: "25px" }}>
                <h3
                  style={{
                    color: secondaryColor,
                    fontSize: "20px",
                    fontWeight: "800",
                    marginBottom: "10px",
                    borderBottom: `2px solid ${secondaryColor}`,
                    display: "inline-block",
                    paddingRight: "20px",
                  }}
                >
                  Terms & Conditions
                </h3>
                <ul style={{ listStyle: "none", marginTop: "10px" }}>
                  {(Array.isArray(policies.termsConditions)
                    ? policies.termsConditions
                    : (policies.termsConditions || "").split("\n")
                  )
                    .filter((line) => line.trim())
                    .map((item, i) => (
                      <li
                        key={i}
                        style={{
                          marginBottom: "8px",
                          paddingLeft: "20px",
                          position: "relative",
                          fontSize: "14px",
                          color: "#444",
                          lineHeight: "1.4",
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            left: 0,
                            color: secondaryColor,
                            fontWeight: "bold",
                          }}
                        >
                          •
                        </span>{" "}
                        {item}
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {/* Cancellation Policy */}
            {policies.cancellationPolicy && (
              <div style={{ marginBottom: "25px" }}>
                <h3
                  style={{
                    color: secondaryColor,
                    fontSize: "20px",
                    fontWeight: "800",
                    marginBottom: "10px",
                    borderBottom: `2px solid ${secondaryColor}`,
                    display: "inline-block",
                    paddingRight: "20px",
                  }}
                >
                  Cancellation Policy
                </h3>
                <ul style={{ listStyle: "none", marginTop: "10px" }}>
                  {(Array.isArray(policies.cancellationPolicy)
                    ? policies.cancellationPolicy
                    : (policies.cancellationPolicy || "").split("\n")
                  )
                    .filter((line) => line.trim())
                    .map((item, i) => (
                      <li
                        key={i}
                        style={{
                          marginBottom: "8px",
                          paddingLeft: "20px",
                          position: "relative",
                          fontSize: "14px",
                          color: "#444",
                          lineHeight: "1.4",
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            left: 0,
                            color: secondaryColor,
                            fontWeight: "bold",
                          }}
                        >
                          •
                        </span>{" "}
                        {item}
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {/* Additional Expenses */}
            {policies.additionalExpenses && (
              <div style={{ marginBottom: "25px" }}>
                <h3
                  style={{
                    color: secondaryColor,
                    fontSize: "20px",
                    fontWeight: "800",
                    marginBottom: "10px",
                    borderBottom: `2px solid ${secondaryColor}`,
                    display: "inline-block",
                    paddingRight: "20px",
                  }}
                >
                  Additional Expenses (Indicative)
                </h3>
                <ul style={{ listStyle: "none", marginTop: "10px" }}>
                  {(Array.isArray(policies.additionalExpenses)
                    ? policies.additionalExpenses
                    : (policies.additionalExpenses || "").split("\n")
                  )
                    .filter((line) => line.trim())
                    .map((item, i) => (
                      <li
                        key={i}
                        style={{
                          marginBottom: "8px",
                          paddingLeft: "20px",
                          position: "relative",
                          fontSize: "14px",
                          color: "#444",
                          lineHeight: "1.4",
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            left: 0,
                            color: secondaryColor,
                            fontWeight: "bold",
                          }}
                        >
                          •
                        </span>{" "}
                        {item}
                      </li>
                    ))}
                </ul>
              </div>
            )}

            <p
              style={{
                fontSize: "14px",
                fontWeight: "600",
                marginTop: "10px",
                color: secondaryColor,
              }}
            >
              Note: Government-fixed rates for activities will be shared
              separately.
            </p>
          </div>
          <ClassicFooter />
        </div>
      )}

      {/* PAGE 8: Combined Must Haves, Roles, and Payment */}
      <div className="classic-page">
        <div className="classic-section-header" style={{ marginTop: "0" }}>
          <div className="classic-section-left">
            <div className="classic-section-title">Important Details</div>
          </div>
          {agencySettings.logo && (
            <img
              src={formatImageUrl(agencySettings.logo)}
              alt="Logo"
              className="classic-section-logo"
            />
          )}
        </div>

        <div
          className="classic-table-container"
          style={{ padding: "0 50px", flex: 1 }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "40px",
              marginBottom: "30px",
            }}
          >
            {/* Must Haves */}
            {policies.mustHaves && (
              <div>
                <h3
                  style={{
                    color: secondaryColor,
                    fontSize: "18px",
                    fontWeight: "800",
                    marginBottom: "10px",
                    borderBottom: `2px solid ${secondaryColor}`,
                    display: "inline-block",
                    paddingRight: "20px",
                  }}
                >
                  Must Haves
                </h3>
                <ul style={{ listStyle: "none", marginTop: "10px" }}>
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
                          paddingLeft: "15px",
                          position: "relative",
                          fontSize: "13px",
                          color: "#444",
                          lineHeight: "1.3",
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            left: 0,
                            color: secondaryColor,
                            fontWeight: "bold",
                          }}
                        >
                          •
                        </span>{" "}
                        {item}
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {/* Roles and Responsibilities */}
            {policies.rolesResponsibilities && (
              <div>
                <h3
                  style={{
                    color: secondaryColor,
                    fontSize: "18px",
                    fontWeight: "800",
                    marginBottom: "10px",
                    borderBottom: `2px solid ${secondaryColor}`,
                    display: "inline-block",
                    paddingRight: "20px",
                  }}
                >
                  Roles & Responsibilities
                </h3>
                <ul style={{ listStyle: "none", marginTop: "10px" }}>
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
                          paddingLeft: "15px",
                          position: "relative",
                          fontSize: "13px",
                          color: "#444",
                          lineHeight: "1.3",
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            left: 0,
                            color: secondaryColor,
                            fontWeight: "bold",
                          }}
                        >
                          •
                        </span>{" "}
                        {item}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>

          <div
            style={{
              background: "#F8F8F8",
              borderRadius: "15px",
              padding: "25px",
              marginBottom: "30px",
              border: `1px solid #E0E0E0`,
            }}
          >
            <h3
              style={{
                fontSize: "20px",
                fontWeight: "800",
                color: secondaryColor,
                marginBottom: "15px",
              }}
            >
              Payment Details:
            </h3>
            <div style={{ display: "grid", gap: "8px" }}>
              <p style={{ fontSize: "15px", color: "#333" }}>
                <span style={{ fontWeight: "700" }}>Beneficiary Name:</span>{" "}
                {agencySettings.beneficiaryName || "N/A"}
              </p>
              <p style={{ fontSize: "15px", color: "#333" }}>
                <span style={{ fontWeight: "700" }}>Bank Name:</span>{" "}
                {agencySettings.bankName || "N/A"}
              </p>
              <p style={{ fontSize: "15px", color: "#333" }}>
                <span style={{ fontWeight: "700" }}>Account Number:</span>{" "}
                {agencySettings.accountNumber || "N/A"}
              </p>
              <p style={{ fontSize: "15px", color: "#333" }}>
                <span style={{ fontWeight: "700" }}>IFSC CODE:</span>{" "}
                {agencySettings.ifscCode || "N/A"}
              </p>
            </div>
          </div>

          <div
            style={{
              background: secondaryColor,
              borderRadius: "15px",
              padding: "25px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              color: "white",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
              <WhatsAppIcon size={32} />
              <div>
                <div style={{ fontSize: "20px", fontWeight: "800" }}>
                  {agencySettings.whatsapp || "N/A"}
                </div>
                <div style={{ fontSize: "12px", opacity: "0.8" }}>
                  WhatsApp Support
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: "12px",
                  opacity: "0.8",
                  marginBottom: "3px",
                }}
              >
                Your Travel Partner
              </div>
              <div style={{ fontSize: "24px", fontWeight: "900" }}>
                {agencySettings.agencyName || "VIAITINERARY"}
              </div>
            </div>
          </div>
        </div>
        <ClassicFooter />
      </div>

      {/* PAGE 9: Thank You */}
      <div
        className="classic-page"
        style={{
          background: secondaryColor,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          color: "white",
        }}
      >
        <h1
          style={{
            fontSize: "80px",
            fontWeight: "900",
            letterSpacing: "4px",
            textAlign: "center",
            fontStyle: "italic",
            marginBottom: "20px",
          }}
        >
          THANK YOU!
        </h1>
        <div
          style={{
            height: "4px",
            width: "200px",
            background: primaryColor,
            marginBottom: "30px",
          }}
        ></div>
        <p
          style={{
            fontSize: "24px",
            fontWeight: "600",
            letterSpacing: "8px",
            textTransform: "uppercase",
            opacity: "0.9",
          }}
        >
          {agencySettings.agencyName || "VIAITINERARY"}
        </p>
        {agencySettings.companyAddress?.trim() ? (
          <p
            style={{
              marginTop: "10px",
              fontSize: "14px",
              fontWeight: "500",
              opacity: "0.9",
              textAlign: "center",
              maxWidth: "70%",
              letterSpacing: "0.2px",
              textTransform: "none",
            }}
          >
            {agencySettings.companyAddress}
          </p>
        ) : null}

        <ClassicFooter light />
      </div>
    </div>
  );
};

export default ClassicTemplate;
