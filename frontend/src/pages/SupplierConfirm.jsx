import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { CheckCircle2, Loader2, XCircle, Link2Off, Phone, Mail, Car, BedDouble } from "lucide-react";
import { fetchSupplierBooking, respondSupplierBooking } from "../api/operations";

// Public supplier page: /s/:token (no login). A hotel or cab supplier opens
// the link from the agency's request email / WhatsApp, sees the booking (no
// prices) and confirms it — with their confirmation number, or for a cab the
// driver's name, phone and vehicle number — or declines with a reason.
// Branded as the agency; the platform's own name never appears.

const fmt = (d) =>
  d
    ? new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
    : "—";

const loads = new Map();
const load = (token) => {
  if (!loads.has(token)) {
    const p = fetchSupplierBooking(token);
    p.catch(() => loads.delete(token));
    loads.set(token, p);
  }
  return loads.get(token);
};

function Row({ label, value }) {
  if (value == null || value === "" || value === 0) return null;
  return (
    <div className="flex gap-3 py-2 border-b border-black/5 last:border-0 text-sm">
      <div className="w-32 shrink-0 text-[#6b7280]">{label}</div>
      <div className="font-semibold text-[#181c22] min-w-0 break-words">{value}</div>
    </div>
  );
}

const Field = ({ label, ...props }) => (
  <label className="block">
    <span className="block text-xs font-semibold text-[#6b7280] mb-1">{label}</span>
    <input
      {...props}
      className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-[15px] text-[#181c22] focus:outline-none focus:ring-2 focus:ring-black/10"
    />
  </label>
);

export default function SupplierConfirm() {
  const { token } = useParams();
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState(null); // confirm | decline
  const [form, setForm] = useState({ reference: "", note: "", driver_name: "", driver_phone: "", vehicle_number: "" });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let alive = true;
    load(token)
      .then((b) => {
        if (!alive) return;
        setBooking(b);
        setForm((f) => ({
          ...f,
          reference: b.reference || "",
          driver_name: b.driver_name || "",
          driver_phone: b.driver_phone || "",
          vehicle_number: b.vehicle_number || "",
        }));
      })
      .catch((err) => alive && setError(err?.message || "This booking link is no longer valid."));
    return () => {
      alive = false;
    };
  }, [token]);

  const submit = async (action) => {
    setFormError("");
    if (action === "decline" && !form.note.trim()) {
      setFormError("Please add a short reason (e.g. sold out) or an alternative you can offer.");
      return;
    }
    setBusy(true);
    try {
      const next = await respondSupplierBooking(token, { action, ...form });
      setBooking(next);
      setMode(null);
    } catch (err) {
      setFormError(err?.message || "Couldn't send your answer. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-[100dvh] bg-[#eef0f1] grid place-items-center px-4">
        <div className="w-full max-w-sm rounded-[24px] bg-white border border-black/5 shadow-sm p-7 text-center">
          <Link2Off className="w-8 h-8 mx-auto text-[#9aa3b2]" />
          <h1 className="mt-3 text-lg font-bold text-[#181c22]">Link not available</h1>
          <p className="mt-1 text-sm text-[#5b6472]">{error} Please contact the travel agency that sent it.</p>
        </div>
      </div>
    );
  }
  if (!booking) {
    return (
      <div className="min-h-[100dvh] bg-[#eef0f1] grid place-items-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#181c22]/40" />
      </div>
    );
  }

  const brand = booking.agency?.brand_color || "#181c22";
  const isHotel = booking.kind === "hotel";
  const done = booking.status === "confirmed" || booking.status === "declined";

  return (
    <div className="min-h-[100dvh] bg-[#eef0f1] pb-16">
      <Helmet>
        <title>{`Booking request · ${booking.agency?.name || ""}`}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <header className="bg-white border-b border-black/5">
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center gap-3">
          {booking.agency?.logo ? (
            <img src={booking.agency.logo} alt="" className="h-9 w-auto max-w-[120px] object-contain" />
          ) : (
            <div className="w-9 h-9 rounded-full grid place-items-center text-white font-bold" style={{ background: brand }}>
              {(booking.agency?.name || "A").charAt(0)}
            </div>
          )}
          <div className="min-w-0">
            <div className="font-bold text-[#181c22] truncate">{booking.agency?.name}</div>
            <div className="text-xs text-[#6b7280]">Booking request · {booking.trip_id}</div>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 pt-5 space-y-4">
        {done && (
          <div
            className={`rounded-2xl p-4 flex gap-3 items-start ${booking.status === "confirmed" ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"}`}
          >
            {booking.status === "confirmed" ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" /> : <XCircle className="w-5 h-5 shrink-0 mt-0.5" />}
            <div className="text-sm">
              <div className="font-bold">
                {booking.status === "confirmed" ? "Confirmed — thank you!" : "Declined"}
              </div>
              <div className="mt-0.5">
                {booking.status === "confirmed"
                  ? `${booking.agency?.name} has been notified.${booking.reference ? ` Your reference: ${booking.reference}.` : ""}`
                  : `${booking.agency?.name} has been told.${booking.note ? ` Your note: “${booking.note}”` : ""}`}
              </div>
              <button type="button" onClick={() => setMode(booking.status === "confirmed" ? "confirm" : "decline")} className="mt-2 text-xs font-bold underline">
                Update your answer
              </button>
            </div>
          </div>
        )}

        <section className="rounded-[22px] bg-white border border-black/5 shadow-sm p-5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#6b7280]">
            {isHotel ? <BedDouble className="w-4 h-4" /> : <Car className="w-4 h-4" />}
            {isHotel ? "Room booking" : "Cab booking"}
          </div>
          <h1 className="mt-1 text-xl font-bold text-[#181c22]">{isHotel ? booking.hotel : booking.vehicle}</h1>
          <div className="mt-3">
            <Row label="Guest" value={booking.guest_name} />
            <Row label="Guests" value={booking.guests} />
            {isHotel ? (
              <>
                <Row label="City" value={booking.city} />
                <Row label="Check-in" value={fmt(booking.check_in)} />
                <Row label="Check-out" value={fmt(booking.check_out)} />
                <Row label="Nights" value={booking.nights} />
                <Row label="Rooms" value={[booking.rooms, booking.room_type].filter(Boolean).join(" × ")} />
                <Row label="Meal plan" value={booking.meal_plan} />
                <Row label="Extra beds" value={booking.extra_beds} />
                <Row label="Extra adults" value={booking.extra_adults} />
                <Row label="Child, no bed" value={booking.children_no_bed} />
              </>
            ) : (
              <Row label="Days" value={booking.days?.length} />
            )}
            <Row label="Reference" value={booking.trip_id} />
          </div>
          {!isHotel && booking.days?.length > 0 && (
            <div className="mt-3 rounded-xl bg-[#f6f7f8] divide-y divide-black/5">
              {booking.days.map((d, i) => (
                <div key={`${d.date}-${i}`} className="px-3 py-2 text-sm flex gap-3">
                  <span className="w-28 shrink-0 text-[#6b7280]">{fmt(d.date)}</span>
                  <span className="font-medium text-[#181c22]">{d.route}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {(!done || mode) && (
          <section className="rounded-[22px] bg-white border border-black/5 shadow-sm p-5 space-y-3">
            {!mode ? (
              <>
                <p className="text-sm text-[#5b6472]">Can you take this booking?</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMode("confirm")}
                    className="rounded-xl py-3 font-bold text-white"
                    style={{ background: brand }}
                  >
                    Yes, confirm
                  </button>
                  <button type="button" onClick={() => setMode("decline")} className="rounded-xl py-3 font-bold bg-[#f3f3f4] text-[#181c22]">
                    Can't do it
                  </button>
                </div>
              </>
            ) : mode === "confirm" ? (
              <>
                {isHotel ? (
                  <Field
                    label="Your confirmation number (optional)"
                    value={form.reference}
                    onChange={(e) => setForm({ ...form, reference: e.target.value })}
                    placeholder="e.g. HB-20931"
                  />
                ) : (
                  <>
                    <Field label="Driver's name" value={form.driver_name} onChange={(e) => setForm({ ...form, driver_name: e.target.value })} />
                    <Field
                      label="Driver's phone"
                      inputMode="tel"
                      value={form.driver_phone}
                      onChange={(e) => setForm({ ...form, driver_phone: e.target.value })}
                    />
                    <Field
                      label="Vehicle number"
                      value={form.vehicle_number}
                      onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })}
                      placeholder="e.g. JK01 AB 1234"
                    />
                    <p className="text-xs text-[#6b7280]">Not assigned yet? Confirm now and send the driver's details to the agency later.</p>
                  </>
                )}
                <Field label="Note for the agency (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                {formError && <p className="text-sm text-red-600">{formError}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => submit("confirm")}
                    className="flex-1 rounded-xl py-3 font-bold text-white disabled:opacity-60"
                    style={{ background: brand }}
                  >
                    {busy ? "Sending…" : "Confirm booking"}
                  </button>
                  <button type="button" onClick={() => setMode(null)} className="rounded-xl px-4 py-3 font-semibold text-[#5b6472]">
                    Back
                  </button>
                </div>
              </>
            ) : (
              <>
                <Field
                  label="Reason or an alternative you can offer"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="e.g. Sold out on these dates — can offer Super Deluxe"
                />
                {formError && <p className="text-sm text-red-600">{formError}</p>}
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={() => submit("decline")} className="flex-1 rounded-xl py-3 font-bold bg-red-600 text-white disabled:opacity-60">
                    {busy ? "Sending…" : "Decline booking"}
                  </button>
                  <button type="button" onClick={() => setMode(null)} className="rounded-xl px-4 py-3 font-semibold text-[#5b6472]">
                    Back
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {(booking.agency?.phone || booking.agency?.email) && (
          <section className="text-sm text-[#5b6472] flex flex-wrap gap-x-5 gap-y-2 px-1">
            <span>Questions? Contact {booking.agency.name}:</span>
            {booking.agency.phone && (
              <a href={`tel:${booking.agency.phone}`} className="inline-flex items-center gap-1 font-semibold text-[#181c22]">
                <Phone className="w-4 h-4" /> {booking.agency.phone}
              </a>
            )}
            {booking.agency.email && (
              <a href={`mailto:${booking.agency.email}`} className="inline-flex items-center gap-1 font-semibold text-[#181c22]">
                <Mail className="w-4 h-4" /> {booking.agency.email}
              </a>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
