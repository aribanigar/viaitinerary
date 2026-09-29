import React, { useMemo, useState } from "react";
import {
  AudioLines,
  CircleAlert,
  Hotel,
  Loader2,
  Mic,
  MicOff,
  Minus,
  Plus,
  SendHorizontal,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { validateChingCommand } from "../../utils/ching/parseCommand";

// Ching's panel: bottom sheet on phones, floating card from `sm` up. Purely
// presentational — ChingWidget owns speech, parsing and building.

const INK = "#181c22";
const LIME = "#e7f63c";

const MEAL_PLANS = [
  "Only Room",
  "Only Room + Breakfast",
  "Breakfast + Dinner",
  "Breakfast + Lunch + Dinner",
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const inputCls =
  "w-full h-10 rounded-xl border bg-white px-3 text-[16px] sm:text-sm text-[#181c22] outline-none transition-colors focus:border-[#181c22] placeholder:text-[#181c22]/35";
const okBorder = "border-black/10";
const badBorder = "border-[#ff5a4d]/70 bg-[#fff6f5]";

const Label = ({ children, htmlFor }) => (
  <label
    htmlFor={htmlFor}
    className="block mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#181c22]/45"
  >
    {children}
  </label>
);

const Section = ({ title, aside, children }) => (
  <section className="space-y-2.5">
    <div className="flex items-center justify-between gap-2">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#181c22]/55">
        {title}
      </h4>
      {aside}
    </div>
    {children}
  </section>
);

const toInt = (v, min = 0, max = 99) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
};

function Stepper({ id, value, onChange, min = 0, max = 99, invalid = false }) {
  const n = Number(value) || 0;
  return (
    <div
      className={`flex items-center h-10 rounded-xl border bg-white overflow-hidden ${invalid ? badBorder : okBorder}`}
    >
      <button
        type="button"
        onClick={() => onChange(toInt(n - 1, min, max))}
        disabled={n <= min}
        className="grid place-items-center w-8 h-full text-[#181c22]/60 hover:bg-black/[0.04] disabled:opacity-30"
        aria-label="Decrease"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={n}
        onChange={(e) => onChange(toInt(e.target.value, min, max))}
        className="flex-1 min-w-0 h-full text-center bg-transparent outline-none text-[16px] sm:text-sm font-semibold text-[#181c22] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={() => onChange(toInt(n + 1, min, max))}
        disabled={n >= max}
        className="grid place-items-center w-8 h-full text-[#181c22]/60 hover:bg-black/[0.04] disabled:opacity-30"
        aria-label="Increase"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── dates / summary ──────────────────────────────────────────────────────
function parseYmd(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ""));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function dateRange(startYmd, nights) {
  const s = parseYmd(startYmd);
  if (!s) return "";
  const e = new Date(s);
  e.setDate(e.getDate() + Math.max(0, Number(nights) || 0));
  const sy = s.getFullYear();
  const ey = e.getFullYear();
  if (sy === ey && s.getMonth() === e.getMonth()) {
    return s.getDate() === e.getDate()
      ? `${s.getDate()} ${MONTHS[s.getMonth()]} ${sy}`
      : `${s.getDate()}–${e.getDate()} ${MONTHS[s.getMonth()]} ${sy}`;
  }
  if (sy === ey) {
    return `${s.getDate()} ${MONTHS[s.getMonth()]} – ${e.getDate()} ${MONTHS[e.getMonth()]} ${sy}`;
  }
  return `${s.getDate()} ${MONTHS[s.getMonth()]} ${sy} – ${e.getDate()} ${MONTHS[e.getMonth()]} ${ey}`;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function summaryLine(c) {
  const parts = [];
  parts.push(c.clientName || "Client name?");
  const pax = [plural(Number(c.adults) || 0, "Adult", "Adults")];
  if (c.children) pax.push(plural(c.children, "Child", "Children"));
  if (c.infants) pax.push(plural(c.infants, "Infant", "Infants"));
  parts.push(pax.join(" + "));
  const range = dateRange(c.startDate, c.nights);
  parts.push(range || "Start date?");
  if (c.nights > 0) parts.push(`${c.nights}N/${c.nights + 1}D`);
  return parts.join(" · ");
}

function exampleCommand(hotels) {
  const byCity = new Map();
  (hotels || []).forEach((h) => {
    if (h?.name && h.city && !byCity.has(h.city)) byCity.set(h.city, h);
  });
  const picks = [...byCity.values()].slice(0, 2);
  const stays =
    picks.length === 2
      ? `2 nights at ${picks[0].name} in ${picks[0].city}, 2 nights at ${picks[1].name} in ${picks[1].city}`
      : "2 nights in Srinagar, 2 nights in Pahalgam";
  return `Create a 5 day trip for Rahul Sharma, 2 adults and 1 child, from 10 November, ${stays}, with Innova, breakfast and dinner.`;
}

function safeValidate(command, init) {
  try {
    const catalog = {
      hotels: init?.hotels || [],
      destinations: init?.destinations || [],
      vehicles: init?.vehicles || [],
    };
    const r = validateChingCommand(command, catalog) || {};
    return {
      ok: Boolean(r.ok),
      problems: Array.isArray(r.problems) ? r.problems : [],
      warnings: Array.isArray(r.warnings) ? r.warnings : [],
    };
  } catch {
    return { ok: false, problems: ["Couldn't check this trip — please review the details."], warnings: [] };
  }
}

// ── confirmation card ────────────────────────────────────────────────────
function CommandCard({ command, setCommand, init, validation, disabled }) {
  const hotels = useMemo(() => init?.hotels || [], [init]);
  const vehicles = init?.vehicles || [];
  const destinations = init?.destinations || [];

  const hotelsById = useMemo(() => {
    const m = new Map();
    hotels.forEach((h) => m.set(String(h.id), h));
    return m;
  }, [hotels]);

  const hotelGroups = useMemo(() => {
    const groups = new Map();
    hotels.forEach((h) => {
      const city = (h.city || "").trim() || "Other";
      if (!groups.has(city)) groups.set(city, []);
      groups.get(city).push(h);
    });
    return [...groups.entries()]
      .sort(([a], [b]) => (a === "Other") - (b === "Other") || a.localeCompare(b))
      .map(([city, list]) => [
        city,
        [...list].sort((a, b) => String(a.name).localeCompare(String(b.name))),
      ]);
  }, [hotels]);

  const update = (patch) => setCommand((prev) => (prev ? { ...prev, ...patch } : prev));

  const stays = Array.isArray(command.stays) ? command.stays : [];
  const staysNights = stays.reduce((sum, s) => sum + (Number(s.nights) || 0), 0);
  const nights = Number(command.nights) || 0;

  const setNights = (n) =>
    setCommand((prev) => {
      if (!prev) return prev;
      const next = { ...prev, nights: n, days: n > 0 ? n + 1 : 0 };
      // A single stay simply follows the trip length.
      if (Array.isArray(prev.stays) && prev.stays.length === 1) {
        next.stays = [{ ...prev.stays[0], nights: n }];
      }
      return next;
    });

  const updateStay = (idx, patch) =>
    setCommand((prev) => {
      if (!prev) return prev;
      const list = [...(prev.stays || [])];
      list[idx] = { ...list[idx], ...patch };
      return { ...prev, stays: list };
    });

  const removeStay = (idx) =>
    setCommand((prev) =>
      prev ? { ...prev, stays: (prev.stays || []).filter((_, i) => i !== idx) } : prev,
    );

  const addStay = () =>
    setCommand((prev) => {
      if (!prev) return prev;
      const list = prev.stays || [];
      const used = list.reduce((s, x) => s + (Number(x.nights) || 0), 0);
      const left = Math.max(1, (Number(prev.nights) || 0) - used);
      return {
        ...prev,
        stays: [...list, { nights: left, hotelId: null, hotelName: "", city: "", heard: "" }],
      };
    });

  const pickHotel = (idx, id) => {
    const h = hotelsById.get(String(id));
    updateStay(
      idx,
      h
        ? { hotelId: h.id, hotelName: h.name || "", city: h.city || "" }
        : { hotelId: null, hotelName: "", city: "" },
    );
  };

  const pickVehicle = (id) => {
    const v = vehicles.find((x) => String(x.id) === String(id));
    update(v ? { vehicleId: v.id, vehicleName: v.name || "" } : { vehicleId: null, vehicleName: "" });
  };

  const pickDestination = (id) => {
    const d = destinations.find((x) => String(x.id) === String(id));
    update(
      d
        ? { destinationId: d.id, destinationName: d.name || "" }
        : { destinationId: null, destinationName: "" },
    );
  };

  const vehicleKnown = vehicles.some((v) => String(v.id) === String(command.vehicleId));
  const destinationKnown = destinations.some((d) => String(d.id) === String(command.destinationId));

  return (
    <fieldset disabled={disabled} className="space-y-5 min-w-0">
      <Section title="Client">
        <div>
          <Label htmlFor="ching-name">Name</Label>
          <input
            id="ching-name"
            value={command.clientName || ""}
            onChange={(e) => update({ clientName: e.target.value })}
            placeholder="Client name"
            autoComplete="off"
            className={`${inputCls} ${command.clientName?.trim() ? okBorder : badBorder}`}
          />
        </div>
        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-2.5">
          <div>
            <Label htmlFor="ching-phone">Phone</Label>
            <input
              id="ching-phone"
              type="tel"
              inputMode="tel"
              value={command.clientPhone || ""}
              onChange={(e) => update({ clientPhone: e.target.value })}
              placeholder="Optional"
              className={`${inputCls} ${okBorder}`}
            />
          </div>
          <div>
            <Label htmlFor="ching-email">Email</Label>
            <input
              id="ching-email"
              type="email"
              inputMode="email"
              value={command.clientEmail || ""}
              onChange={(e) => update({ clientEmail: e.target.value })}
              placeholder="Optional"
              className={`${inputCls} ${okBorder}`}
            />
          </div>
        </div>
      </Section>

      <Section title="Travellers">
        <div className="grid grid-cols-3 gap-2">
          <div className="min-w-0">
            <Label htmlFor="ching-adults">Adults</Label>
            <Stepper
              id="ching-adults"
              value={command.adults}
              min={0}
              max={60}
              invalid={(Number(command.adults) || 0) < 1}
              onChange={(n) => update({ adults: n })}
            />
          </div>
          <div className="min-w-0">
            <Label htmlFor="ching-children">Child 5–12</Label>
            <Stepper
              id="ching-children"
              value={command.children}
              max={30}
              onChange={(n) => update({ children: n })}
            />
          </div>
          <div className="min-w-0">
            <Label htmlFor="ching-infants">Infant &lt;5</Label>
            <Stepper
              id="ching-infants"
              value={command.infants}
              max={30}
              onChange={(n) => update({ infants: n })}
            />
          </div>
        </div>
      </Section>

      <Section title="Dates">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="min-w-0">
            <Label htmlFor="ching-start">Start date</Label>
            <input
              id="ching-start"
              type="date"
              value={command.startDate || ""}
              onChange={(e) => update({ startDate: e.target.value })}
              className={`${inputCls} ${parseYmd(command.startDate) ? okBorder : badBorder}`}
            />
          </div>
          <div className="min-w-0">
            <Label htmlFor="ching-nights">Nights</Label>
            <Stepper
              id="ching-nights"
              value={nights}
              max={60}
              invalid={nights < 1}
              onChange={setNights}
            />
          </div>
        </div>
        <p className="text-xs text-[#181c22]/50">
          {nights > 0 ? `${nights + 1} days` : "Days = nights + 1"}
          {dateRange(command.startDate, nights) && nights > 0
            ? ` · ${dateRange(command.startDate, nights)}`
            : ""}
        </p>
      </Section>

      <Section
        title="Stays"
        aside={
          <span
            className={`text-[11px] font-semibold ${
              stays.length && staysNights !== nights ? "text-[#d4382c]" : "text-[#181c22]/45"
            }`}
          >
            {staysNights} / {nights} nights
          </span>
        }
      >
        {stays.length === 0 && (
          <p className="text-xs text-[#181c22]/50">
            No hotels yet — the trip gets a day plan only. Add a stay to include one.
          </p>
        )}
        {stays.map((stay, idx) => {
          const known = hotelsById.has(String(stay.hotelId));
          const missing = stay.hotelId == null || stay.hotelId === "";
          const hotel = hotelsById.get(String(stay.hotelId));
          return (
            <div
              key={idx}
              className="rounded-2xl border border-black/[0.07] bg-[#fafafa] p-2.5 space-y-2"
            >
              <div className="flex items-center gap-2">
                <Hotel className="w-4 h-4 shrink-0 text-[#181c22]/40" />
                <select
                  aria-label={`Hotel for stay ${idx + 1}`}
                  value={missing ? "" : String(stay.hotelId)}
                  onChange={(e) => pickHotel(idx, e.target.value)}
                  className={`${inputCls} ${missing ? badBorder : okBorder} min-w-0 pr-8`}
                >
                  <option value="">Choose hotel…</option>
                  {!missing && !known && (
                    <option value={String(stay.hotelId)}>{stay.hotelName || `Hotel #${stay.hotelId}`}</option>
                  )}
                  {hotelGroups.map(([city, list]) => (
                    <optgroup key={city} label={city}>
                      {list.map((h) => (
                        <option key={h.id} value={String(h.id)}>
                          {h.name}
                          {h.category ? ` · ${h.category}` : ""}
                          {h.is_available === false ? " (unavailable)" : ""}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-[118px] shrink-0">
                  <Stepper
                    value={stay.nights}
                    max={60}
                    invalid={(Number(stay.nights) || 0) < 1}
                    onChange={(n) => updateStay(idx, { nights: n })}
                  />
                </div>
                <span className="flex-1 min-w-0 text-xs text-[#181c22]/50 truncate">
                  {missing
                    ? stay.heard
                      ? `Heard “${stay.heard}” — pick the hotel`
                      : "Pick a hotel"
                    : `${Number(stay.nights) === 1 ? "night" : "nights"} · ${hotel?.city || stay.city || ""}`}
                </span>
                <button
                  type="button"
                  onClick={() => removeStay(idx)}
                  className="grid place-items-center w-9 h-9 shrink-0 rounded-xl text-[#181c22]/45 hover:text-[#d4382c] hover:bg-[#ff5a4d]/10"
                  aria-label={`Remove stay ${idx + 1}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
        <button
          type="button"
          onClick={addStay}
          className="w-full h-10 rounded-xl border border-dashed border-black/15 text-xs font-semibold text-[#181c22]/60 hover:text-[#181c22] hover:border-black/30 flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Add stay
        </button>
      </Section>

      <Section title="Trip details">
        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-2.5">
          <div className="min-w-0">
            <Label htmlFor="ching-vehicle">Vehicle</Label>
            <select
              id="ching-vehicle"
              value={command.vehicleId == null ? "" : String(command.vehicleId)}
              onChange={(e) => pickVehicle(e.target.value)}
              className={`${inputCls} ${okBorder}`}
            >
              <option value="">No vehicle</option>
              {command.vehicleId != null && !vehicleKnown && (
                <option value={String(command.vehicleId)}>{command.vehicleName || "Vehicle"}</option>
              )}
              {vehicles.map((v) => (
                <option key={v.id} value={String(v.id)}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <Label htmlFor="ching-meal">Meal plan</Label>
            <select
              id="ching-meal"
              value={command.mealPlan || ""}
              onChange={(e) => update({ mealPlan: e.target.value })}
              className={`${inputCls} ${okBorder}`}
            >
              <option value="">None</option>
              {MEAL_PLANS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          {destinations.length > 0 && (
            <div className="min-w-0 min-[400px]:col-span-2">
              <Label htmlFor="ching-dest">Destination</Label>
              <select
                id="ching-dest"
                value={command.destinationId == null ? "" : String(command.destinationId)}
                onChange={(e) => pickDestination(e.target.value)}
                className={`${inputCls} ${okBorder}`}
              >
                <option value="">Auto (from the hotels)</option>
                {command.destinationId != null && !destinationKnown && (
                  <option value={String(command.destinationId)}>
                    {command.destinationName || "Destination"}
                  </option>
                )}
                {destinations.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.name}
                    {d.city && d.city !== d.name ? ` · ${d.city}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </Section>

      {(validation.problems.length > 0 || validation.warnings.length > 0) && (
        <div className="space-y-2">
          {validation.problems.length > 0 && (
            <ul className="rounded-2xl border border-[#ff5a4d]/30 bg-[#fff4f3] p-3 space-y-1.5">
              {validation.problems.map((p, i) => (
                <li key={i} className="flex gap-2 text-xs font-medium text-[#b42318]">
                  <CircleAlert className="w-3.5 h-3.5 mt-px shrink-0" /> {p}
                </li>
              ))}
            </ul>
          )}
          {validation.warnings.length > 0 && (
            <ul className="rounded-2xl border border-amber-300/60 bg-amber-50 p-3 space-y-1.5">
              {validation.warnings.map((w, i) => (
                <li key={i} className="flex gap-2 text-xs font-medium text-amber-800">
                  <TriangleAlert className="w-3.5 h-3.5 mt-px shrink-0" /> {w}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </fieldset>
  );
}

// ── big mic ──────────────────────────────────────────────────────────────
function BigMic({ listening, disabled, onClick, supported }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={listening ? "Stop listening" : "Start listening"}
      className={`relative grid place-items-center w-20 h-20 rounded-full transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${
        listening
          ? "bg-[#e7f63c] text-[#181c22] scale-105"
          : "bg-[#181c22] text-white hover:scale-105 active:scale-95"
      } shadow-[0_16px_40px_-14px_rgba(16,24,42,0.65)]`}
    >
      {listening && (
        <>
          <span className="absolute inset-0 rounded-full bg-[#e7f63c] opacity-40 animate-ping" />
          <span className="absolute -inset-2 rounded-full border-2 border-[#e7f63c]/60 animate-pulse" />
        </>
      )}
      {supported ? (
        <Mic className="relative w-8 h-8" strokeWidth={2} />
      ) : (
        <MicOff className="relative w-8 h-8" strokeWidth={2} />
      )}
    </button>
  );
}

// ── panel ────────────────────────────────────────────────────────────────
export default function ChingPanel({
  speech,
  handsFree,
  onToggleHandsFree,
  status,
  command,
  setCommand,
  edited,
  init,
  notice,
  onDismissNotice,
  onSubmitText,
  onConfirm,
  onDiscard,
  onClose,
}) {
  const [draft, setDraft] = useState("");
  const { supported, phase, interim, error, wakeBlocked } = speech;
  const listening = phase === "command";
  const thinking = status === "thinking";
  const building = status === "building";
  const validation = useMemo(
    () => (command ? safeValidate(command, init) : { ok: false, problems: [], warnings: [] }),
    [command, init],
  );
  const example = useMemo(() => exampleCommand(init?.hotels), [init]);

  const submitDraft = (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || building) return;
    speech.clearError();
    setDraft("");
    onSubmitText(text);
  };

  const statusLabel = listening
    ? "Listening… pause when you're done"
    : thinking
      ? "Thinking…"
      : !supported
        ? "Voice isn't supported here — type below"
        : phase === "wake"
          ? "Say “Hello Ching” — or tap the mic"
          : "Tap the mic and speak · Alt+C";

  const showHero = !command || listening || thinking;
  const parserNotes =
    !edited && Array.isArray(command?.warnings) ? command.warnings.filter(Boolean) : [];

  return (
    <>
      {/* Phone backdrop */}
      <div
        className="sm:hidden fixed inset-0 z-[85] bg-[#181c22]/35 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-label="Ching voice trip builder"
        className="fixed z-[90] inset-x-0 bottom-0 max-h-[90dvh] sm:inset-x-auto sm:right-4 lg:right-6 sm:bottom-[calc(env(safe-area-inset-bottom)+136px)] lg:bottom-[92px] sm:w-[400px] sm:max-h-[calc(100dvh-180px)] lg:max-h-[calc(100dvh-116px)] flex flex-col bg-white text-[#181c22] rounded-t-[28px] sm:rounded-[24px] border border-black/5 shadow-[0_-10px_50px_-20px_rgba(16,24,42,0.45)] sm:shadow-[0_24px_70px_-24px_rgba(16,24,42,0.55)] overflow-hidden"
      >
        <div className="sm:hidden mx-auto mt-2 w-10 h-1 rounded-full bg-black/10 shrink-0" />

        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 pt-3 pb-3 border-b border-black/5 shrink-0">
          <span className="grid place-items-center w-9 h-9 rounded-full shrink-0" style={{ background: INK }}>
            <AudioLines className="w-[18px] h-[18px]" style={{ color: LIME }} strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold tracking-tight leading-tight">Ching</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#181c22]/45 leading-tight">
              Voice trip builder
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={handsFree}
            onClick={onToggleHandsFree}
            disabled={!supported}
            title={
              wakeBlocked && handsFree
                ? "Hands-free is paused — microphone unavailable"
                : "Hands-free: say “Hello Ching” on any page"
            }
            className="ml-auto flex items-center gap-2 h-8 pl-3 pr-1 rounded-full border border-black/10 bg-white hover:bg-black/[0.03] disabled:opacity-40 shrink-0"
          >
            <span className="text-[11px] font-semibold whitespace-nowrap">Hello Ching</span>
            <span
              className={`relative w-9 h-6 rounded-full transition-colors ${
                handsFree ? (wakeBlocked ? "bg-amber-400" : "bg-[#181c22]") : "bg-black/15"
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full transition-all ${
                  handsFree ? "left-4 bg-[#e7f63c]" : "left-1 bg-white"
                }`}
              />
            </span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="grid place-items-center w-8 h-8 rounded-full text-[#181c22]/55 hover:bg-black/[0.05] shrink-0"
            aria-label="Close Ching"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-4">
          {showHero ? (
            <div className="flex flex-col items-center text-center gap-3 pt-1">
              <BigMic
                listening={listening}
                supported={supported}
                disabled={!supported || thinking || building}
                onClick={speech.toggleCommand}
              />
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#181c22]/45 flex items-center gap-1.5">
                {thinking && <Loader2 className="w-3 h-3 animate-spin" />}
                {statusLabel}
              </div>
              <div
                className="w-full min-h-[3.25rem] rounded-2xl bg-[#f4f5f6] px-4 py-3 text-[15px] leading-snug text-left"
                aria-live="polite"
              >
                {interim ? (
                  <span className="text-[#181c22]">{interim}</span>
                ) : (
                  <span className="text-[#181c22]/40">
                    {listening ? "Go ahead — I'm listening…" : `“${example}”`}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-2xl bg-[#f4f5f6] p-3">
              <button
                type="button"
                onClick={speech.startCommand}
                disabled={!supported || building}
                className="grid place-items-center w-10 h-10 shrink-0 rounded-full bg-[#181c22] text-white disabled:opacity-40"
                aria-label="Speak a new request"
                title="Speak a new request (Alt+C)"
              >
                <Mic className="w-4 h-4" />
              </button>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#181c22]/45">
                  Heard
                </div>
                <p className="text-[13px] leading-snug text-[#181c22]/75 break-words">
                  “{command.transcript}”
                </p>
                {parserNotes.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {parserNotes.map((n, i) => (
                      <li key={i} className="text-[11px] text-[#181c22]/50">
                        · {n}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-2xl border border-[#ff5a4d]/30 bg-[#fff4f3] p-3 text-xs font-medium text-[#b42318]">
              <CircleAlert className="w-4 h-4 shrink-0" />
              <span className="flex-1">{error}</span>
              <button type="button" onClick={speech.clearError} aria-label="Dismiss" className="shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {notice && !listening && (
            <div
              className={`rounded-2xl border p-3 text-xs ${
                notice.kind === "error"
                  ? "border-[#ff5a4d]/30 bg-[#fff4f3] text-[#b42318]"
                  : "border-black/10 bg-white text-[#181c22]"
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="flex-1 font-semibold text-[13px]">
                  {notice.kind === "error" ? notice.text : "I didn't catch a trip request."}
                </span>
                <button type="button" onClick={onDismissNotice} aria-label="Dismiss" className="shrink-0 opacity-60">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {notice.kind === "unknown" && (
                <>
                  <p className="mt-1 text-[#181c22]/55">Heard: “{notice.text}”</p>
                  <p className="mt-2 text-[#181c22]/70">
                    Try something like:{" "}
                    <button
                      type="button"
                      onClick={() => setDraft(example)}
                      className="text-left font-medium text-[#181c22] underline decoration-[#e7f63c] decoration-2 underline-offset-2"
                    >
                      “{example}”
                    </button>
                  </p>
                </>
              )}
            </div>
          )}

          {command && !thinking && (
            <>
              <div className="rounded-2xl p-4" style={{ background: INK }}>
                <div
                  className="text-[10px] font-semibold uppercase tracking-[0.16em]"
                  style={{ color: LIME }}
                >
                  {validation.problems.length ? "Almost there" : "Ready to build"}
                </div>
                <div className="mt-1 text-[15px] font-semibold leading-snug text-white break-words">
                  {summaryLine(command)}
                </div>
              </div>
              <CommandCard
                command={command}
                setCommand={setCommand}
                init={init}
                validation={validation}
                disabled={building}
              />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-black/5 bg-white px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] space-y-2.5">
          {command && !thinking && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onDiscard}
                disabled={building}
                className="h-11 px-4 rounded-full text-xs font-semibold text-[#181c22]/60 hover:text-[#181c22] hover:bg-black/[0.04] disabled:opacity-40"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={building || validation.problems.length > 0}
                className="flex-1 h-11 rounded-full bg-[#e7f63c] text-[#181c22] text-sm font-semibold shadow-sm shadow-[#e7f63c]/40 hover:bg-[#d4e42e] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {building ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Building trip…
                  </>
                ) : validation.problems.length > 0 ? (
                  `Fix ${plural(validation.problems.length, "issue", "issues")} to build`
                ) : (
                  "Confirm & Build"
                )}
              </button>
            </div>
          )}
          {building && (
            <p className="text-[11px] text-center text-[#181c22]/50">
              Creating the itinerary, hotels and transport — the PDF follows in the Trip Builder.
            </p>
          )}
          <form onSubmit={submitDraft} className="flex items-center gap-2 rounded-full border border-black/10 bg-white pl-4 pr-1.5 py-1.5 focus-within:border-[#181c22]">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={command ? "Type a new request…" : "Type your request…"}
              autoFocus={!supported}
              disabled={building}
              enterKeyHint="send"
              className="flex-1 min-w-0 bg-transparent outline-none text-[16px] sm:text-sm text-[#181c22] placeholder:text-[#181c22]/40"
            />
            <button
              type="submit"
              disabled={!draft.trim() || building || thinking}
              className="grid place-items-center w-9 h-9 rounded-full bg-[#181c22] text-white shrink-0 disabled:opacity-30"
              aria-label="Send"
            >
              <SendHorizontal className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
