import React, { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { toast } from "react-toastify";
import {
  CheckCircle2,
  Download,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  PencilLine,
  Link2Off,
} from "lucide-react";
import { request } from "../utils/apiClient";
import {
  formatTripImageUrl,
  mapAgencySettings,
  mapPolicies,
  mapSavedTrip,
} from "../utils/tripView";
import ModernTemplate from "../components/dashboard/ModernTemplate";
import ScaledPages from "../components/proposal/ScaledPages";
import RespondSheet from "../components/proposal/RespondSheet";

// Public client proposal: /p/:token (no login). Branded as the AGENCY — the
// platform's own name never appears here. `?preview=1` is the agent's own
// preview: it isn't counted as a client view and can't respond.

const INK = "#181c22";

// One GET per token per page load (StrictMode double-mount would otherwise
// count two client views).
const loads = new Map();
function loadProposal(token, preview) {
  const key = `${token}|${preview ? 1 : 0}`;
  if (!loads.has(key)) {
    const p = request(
      `/public/proposals/${encodeURIComponent(token)}${preview ? "?preview=1" : ""}`,
    );
    p.catch(() => loads.delete(key));
    loads.set(key, p);
  }
  return loads.get(key);
}

function respond(token, body) {
  return request(`/public/proposals/${encodeURIComponent(token)}/respond`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function normalizeHex(hex) {
  const s = String(hex || "").trim();
  const m3 = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(s);
  if (m3) return `#${m3[1]}${m3[1]}${m3[2]}${m3[2]}${m3[3]}${m3[3]}`;
  const m6 = /^#?([0-9a-f]{6})$/i.exec(s);
  return m6 ? `#${m6[1]}` : null;
}

function readableOn(hex) {
  const n = parseInt(hex.slice(1), 16);
  const l = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.62 ? INK : "#ffffff";
}

const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

function formatPrice(cost, symbol, currency) {
  const n = Number(cost);
  if (!Number.isFinite(n) || n <= 0) return "";
  const indian = symbol === "₹" || /INR/i.test(currency || "");
  const num = new Intl.NumberFormat(indian ? "en-IN" : "en-US", {
    maximumFractionDigits: 0,
  }).format(Math.round(n));
  return `${symbol || ""}${num}`;
}

function whatsappDigits(raw) {
  const d = String(raw || "").replace(/\D/g, "");
  if (!d) return "";
  // Bare 10-digit Indian mobile numbers need the country code for wa.me.
  return d.length === 10 ? `91${d}` : d.replace(/^0+/, "");
}

// ── states ───────────────────────────────────────────────────────────────
const Skeleton = () => (
  <div className="min-h-[100dvh] bg-[#eef0f1]" aria-busy="true">
    <div className="bg-white border-b border-black/5">
      <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3 animate-pulse">
        <div className="w-10 h-10 rounded-full bg-black/10" />
        <div className="h-4 w-40 rounded bg-black/10" />
      </div>
    </div>
    <div className="max-w-[820px] mx-auto px-4 py-6 space-y-4 animate-pulse">
      <div className="h-5 w-2/3 rounded bg-black/10" />
      <div className="aspect-[210/297] w-full rounded-lg bg-white" />
    </div>
  </div>
);

const Message = ({ icon, title, body, action }) => {
  const Icon = icon;
  return (
  <div className="min-h-[100dvh] bg-[#eef0f1] grid place-items-center px-4">
    <Helmet>
      <title>{title}</title>
      <meta name="robots" content="noindex, nofollow" />
    </Helmet>
    <div className="w-full max-w-sm rounded-[24px] bg-white border border-black/5 shadow-sm p-7 text-center">
      <span className="mx-auto grid place-items-center w-12 h-12 rounded-full bg-[#f1f2f3] text-[#181c22]/60">
        <Icon className="w-6 h-6" />
      </span>
      <h1 className="mt-4 text-lg font-semibold text-[#181c22]">{title}</h1>
      <p className="mt-1.5 text-sm text-[#181c22]/60">{body}</p>
      {action}
    </div>
  </div>
  );
};

// ── page ─────────────────────────────────────────────────────────────────
export default function Proposal() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const preview = searchParams.get("preview") === "1";

  const [state, setState] = useState({ status: "loading" });
  const [response, setResponse] = useState(null); // latest { response, responded_at }
  const [sheet, setSheet] = useState(null); // "approve" | "changes" | null
  const [talkOpen, setTalkOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let alive = true;
    loadProposal(token, preview)
      .then((data) => alive && setState({ status: "ready", data }))
      .catch((err) => {
        if (!alive) return;
        setState({
          status: err?.status === 404 ? "notfound" : err?.status === 429 ? "busy" : "error",
        });
      });
    return () => {
      alive = false;
    };
  }, [token, preview]);

  const view = useMemo(() => {
    if (state.status !== "ready") return null;
    const { settings = {}, policies, trip } = state.data || {};
    if (!trip) return null;
    const defaultImage = formatTripImageUrl(settings.default_trip_image_url) || "";
    const mapped = mapSavedTrip(
      { trip, settings, destinations: [] },
      { configuredDefaultTripImage: defaultImage },
    );
    const brand = normalizeHex(settings.brand_color) || "#FAA61A";
    return {
      trip,
      settings,
      mapped,
      agencySettings: mapAgencySettings(settings, defaultImage),
      policies: mapPolicies(policies || {}),
      brand,
      brandText: readableOn(brand),
      agencyName: settings.agency_name || "Your travel agent",
      logo: formatTripImageUrl(settings.logo_url),
    };
  }, [state]);

  if (state.status === "loading") return <Skeleton />;
  if (state.status === "notfound" || (state.status === "ready" && !view)) {
    return (
      <Message
        icon={Link2Off}
        title="This link isn't available"
        body="The proposal may have been withdrawn, or the link is incomplete. Please ask your travel agent to send it again."
      />
    );
  }
  if (state.status !== "ready") {
    return (
      <Message
        icon={Link2Off}
        title="We couldn't open this proposal"
        body={
          state.status === "busy"
            ? "Please wait a minute and try again."
            : "Please check your connection and try again."
        }
        action={
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 h-11 px-6 rounded-full bg-[#181c22] text-white text-sm font-semibold"
          >
            Try again
          </button>
        }
      />
    );
  }

  const { trip, settings, mapped, agencySettings, policies, brand, brandText, agencyName, logo } =
    view;
  const current = response || state.data.proposal || {};
  const responded = current.response;
  const title = trip.trip_title || "Your trip";
  const price = formatPrice(trip.cost, trip.currency_symbol, trip.currency);

  const wa = whatsappDigits(settings.whatsapp);
  const waText = `Hi, about my trip ${title} (${trip.trip_id}): `;
  const contacts = [
    wa && {
      key: "wa",
      label: "WhatsApp",
      icon: MessageCircle,
      href: `https://wa.me/${wa}?text=${encodeURIComponent(waText)}`,
      external: true,
    },
    settings.contact_phone && {
      key: "tel",
      label: "Call",
      icon: Phone,
      href: `tel:${String(settings.contact_phone).replace(/[^\d+]/g, "")}`,
    },
    settings.contact_email && {
      key: "mail",
      label: "Email",
      icon: Mail,
      href: `mailto:${settings.contact_email}?subject=${encodeURIComponent(`${title} (${trip.trip_id})`)}`,
    },
  ].filter(Boolean);

  const submit = async ({ name, message }) => {
    const res = await respond(token, {
      action: sheet === "approve" ? "approve" : "request_changes",
      name: name || undefined,
      message: message || undefined,
    });
    setResponse(res);
  };

  const downloadPdf = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const { exportPreviewToPdf } = await import("../utils/exportPdf");
      await exportPreviewToPdf(`${trip.trip_id || "Trip"}_Itinerary.pdf`);
    } catch {
      toast.error("Couldn't create the PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const talkButton = (compact) =>
    contacts.length === 0 ? null : contacts.length === 1 ? (
      <a
        href={contacts[0].href}
        target={contacts[0].external ? "_blank" : undefined}
        rel={contacts[0].external ? "noopener noreferrer" : undefined}
        className="flex items-center gap-1.5 h-10 px-3 rounded-full border border-black/10 bg-white text-xs font-semibold text-[#181c22] hover:bg-black/[0.03]"
        aria-label="Talk to us"
      >
        <MessageCircle className="w-4 h-4" />
        {!compact && "Talk to us"}
      </a>
    ) : (
      <button
        type="button"
        onClick={() => setTalkOpen((v) => !v)}
        aria-expanded={talkOpen}
        className="flex items-center gap-1.5 h-10 px-3 rounded-full border border-black/10 bg-white text-xs font-semibold text-[#181c22] hover:bg-black/[0.03]"
        aria-label="Talk to us"
      >
        <MessageCircle className="w-4 h-4" />
        {!compact && "Talk to us"}
      </button>
    );

  const pdfButton = (compact) => (
    <button
      type="button"
      onClick={downloadPdf}
      disabled={downloading}
      className="flex items-center gap-1.5 h-10 px-3 rounded-full border border-black/10 bg-white text-xs font-semibold text-[#181c22] hover:bg-black/[0.03] disabled:opacity-60"
      aria-label="Download PDF"
    >
      {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      {!compact && (downloading ? "Preparing…" : "Download PDF")}
    </button>
  );

  const statusLine =
    responded === "approved"
      ? `You approved this trip${current.responded_at ? ` on ${fmtDate(current.responded_at)}` : ""}`
      : responded === "changes_requested"
        ? `You asked for changes${current.responded_at ? ` on ${fmtDate(current.responded_at)}` : ""}`
        : "";

  const disabledTitle = preview ? "Preview only — your client responds here" : undefined;

  return (
    <div className="min-h-[100dvh] bg-[#eef0f1] text-[#181c22]">
      <Helmet>
        <title>{`${title} · ${agencyName}`}</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="theme-color" content={brand} />
      </Helmet>

      {preview && (
        <div className="bg-[#181c22] text-white text-center text-xs font-medium px-4 py-2">
          Preview — this is what your client sees. Responses are disabled here.
        </div>
      )}

      {/* Agency header */}
      <header className="bg-white border-b border-black/5" style={{ borderTop: `4px solid ${brand}` }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          {logo ? (
            <img src={logo} alt={agencyName} className="h-10 max-w-[150px] object-contain shrink-0" />
          ) : (
            <span
              className="grid place-items-center w-10 h-10 rounded-full text-base font-bold shrink-0"
              style={{ background: brand, color: brandText }}
            >
              {agencyName.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <div className="text-[15px] font-semibold truncate">{agencyName}</div>
            {settings.website && (
              <div className="text-xs text-[#181c22]/50 truncate">{settings.website}</div>
            )}
          </div>
          {settings.contact_phone && (
            <a
              href={`tel:${String(settings.contact_phone).replace(/[^\d+]/g, "")}`}
              className="ml-auto hidden sm:flex items-center gap-1.5 text-sm font-medium text-[#181c22]/70 hover:text-[#181c22]"
            >
              <Phone className="w-4 h-4" /> {settings.contact_phone}
            </a>
          )}
        </div>
      </header>

      {/* Intro */}
      <div className="max-w-[830px] mx-auto px-4 pt-5 pb-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: brand }}>
          Your trip proposal
        </div>
        <h1 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight">{title}</h1>
        {trip.client_name && (
          <p className="mt-0.5 text-sm text-[#181c22]/55">
            Prepared for {trip.client_name} · {trip.trip_id}
          </p>
        )}
      </div>

      {/* Itinerary pages */}
      <main className="pb-[calc(env(safe-area-inset-bottom)+150px)] sm:pb-[calc(env(safe-area-inset-bottom)+110px)]">
        <ScaledPages>
          <ModernTemplate
            tripInfo={mapped.tripInfo}
            itinerary={mapped.itinerary}
            accommodations={mapped.accommodations}
            transportation={mapped.transportation}
            tripActivities={mapped.tripActivities}
            agencySettings={agencySettings}
            inclusions={mapped.inclusions}
            exclusions={mapped.exclusions}
            policies={policies}
            includeGST={mapped.includeGST}
          />
        </ScaledPages>
      </main>

      {/* Closes the "Talk to us" menu (outside the bar: its backdrop blur
          would trap a fixed overlay inside it). */}
      {talkOpen && (
        <div className="fixed inset-0 z-30" onClick={() => setTalkOpen(false)} aria-hidden />
      )}

      {/* Sticky action bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-black/5 shadow-[0_-12px_40px_-24px_rgba(16,24,42,0.4)] pb-[env(safe-area-inset-bottom)]">
        {talkOpen && contacts.length > 1 && (
          <>
            <div className="absolute z-10 bottom-full mb-2 right-4 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 w-52 rounded-2xl bg-white border border-black/5 shadow-xl overflow-hidden">
              {contacts.map((c) => {
                const Icon = c.icon;
                return (
                  <a
                    key={c.key}
                    href={c.href}
                    target={c.external ? "_blank" : undefined}
                    rel={c.external ? "noopener noreferrer" : undefined}
                    onClick={() => setTalkOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-3 text-sm font-medium text-[#181c22] hover:bg-black/[0.03]"
                  >
                    <Icon className="w-4 h-4 text-[#181c22]/60" /> {c.label}
                  </a>
                );
              })}
            </div>
          </>
        )}
        <div className="relative max-w-5xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-4">
          <div className="flex items-center justify-between gap-3 sm:flex-1 min-w-0">
            <div className="min-w-0">
              {statusLine && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#181c22]/70">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: brand }} />
                  <span className="truncate">{statusLine}</span>
                </div>
              )}
              {price ? (
                <div className="text-lg sm:text-xl font-bold tracking-tight leading-tight">
                  {price}{" "}
                  {mapped.includeGST && (
                    <span className="text-xs font-medium text-[#181c22]/55">incl. GST</span>
                  )}
                </div>
              ) : (
                !statusLine && <div className="text-sm font-semibold">{title}</div>
              )}
            </div>
            <div className="flex items-center gap-1.5 sm:hidden">
              {talkButton(true)}
              {pdfButton(true)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5">
              {talkButton(false)}
              {pdfButton(false)}
            </div>
            <button
              type="button"
              onClick={() => setSheet("changes")}
              disabled={preview}
              title={disabledTitle}
              className="flex-1 sm:flex-none h-11 px-5 rounded-full border border-black/15 bg-white text-sm font-semibold text-[#181c22] hover:bg-black/[0.03] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <PencilLine className="w-4 h-4" />
              {responded === "changes_requested" ? "More changes" : "Request changes"}
            </button>
            {responded !== "approved" && (
              <button
                type="button"
                onClick={() => setSheet("approve")}
                disabled={preview}
                title={disabledTitle}
                className="flex-1 sm:flex-none h-11 px-6 rounded-full text-sm font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                style={{ background: brand, color: brandText }}
              >
                <CheckCircle2 className="w-4 h-4" /> Approve trip
              </button>
            )}
          </div>
        </div>
      </div>

      {sheet && (
        <RespondSheet
          key={sheet}
          mode={sheet}
          agencyName={agencyName}
          defaultName={current.responder || trip.client_name || ""}
          brand={brand}
          brandText={brandText}
          onSubmit={submit}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}
