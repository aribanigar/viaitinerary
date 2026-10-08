import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import {
  ArrowRight,
  BedDouble,
  Car,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  MailCheck,
  MessageCircle,
  PlaneLanding,
  PlaneTakeoff,
  RefreshCw,
  UserRound,
  Wallet,
  XCircle,
} from "lucide-react";
import DashboardLayout from "./DashboardLayout";
import { useAuth } from "../../context/AuthContext";
import {
  fetchOperations,
  requestSupplierConfirmations,
  updateBooking,
} from "../../api/operations";
import SupplierChip from "../operations/SupplierChip";

// Daily Operations (Phase 3): who arrives / leaves / checks in on a day, every
// cab with its driver, bookings still waiting for the supplier to confirm,
// and balances due — with one-tap actions (request / remind / WhatsApp / mark
// confirmed / assign a driver / send the driver's details to the client).

const pad = (n) => String(n).padStart(2, "0");
const localYmd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (ymd, n) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return localYmd(new Date(y, m - 1, d + n));
};
const dayLabel = (ymd, today) => {
  if (ymd === today) return "Today";
  if (ymd === addDays(today, 1)) return "Tomorrow";
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
};
const shortDate = (ymd) => {
  if (!ymd) return "—";
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};
const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const waUrl = (phone, text) => {
  const d = String(phone || "").replace(/\D/g, "");
  if (d.length < 10) return null;
  return `https://wa.me/${d.length === 10 ? `91${d}` : d}?text=${encodeURIComponent(text)}`;
};

const Card = ({ title, icon, count, children, empty }) => (
  <section className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
    <div className="px-5 py-3.5 border-b border-black/5 flex items-center gap-2 bg-[#f3f3f4]/60">
      {React.createElement(icon, { className: "w-4 h-4 text-ink/60" })}
      <h3 className="text-xs font-bold text-ink uppercase tracking-widest">{title}</h3>
      <span className="ml-auto text-xs font-bold text-[#8a93a2]">{count}</span>
    </div>
    {count ? <div className="divide-y divide-black/5">{children}</div> : <p className="px-5 py-6 text-sm text-[#8a93a2]">{empty}</p>}
  </section>
);

const TripLine = ({ trip, extra }) => (
  <div className="min-w-0 flex-1">
    <div className="text-sm font-semibold text-ink truncate">
      {trip.client_name || "Client"} <span className="font-normal text-[#5b6472]">· {trip.title}</span>
    </div>
    <div className="text-xs text-[#5b6472] truncate">
      {trip.trip_id} · {trip.guests} pax · {shortDate(trip.start_date)} – {shortDate(trip.end_date)}
      {extra ? <span> · {extra}</span> : null}
    </div>
  </div>
);

const IconBtn = ({ title, onClick, href, children, disabled }) =>
  href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" title={title} className="p-2 rounded-xl text-ink/60 hover:text-ink hover:bg-black/[0.04]">
      {children}
    </a>
  ) : (
    <button type="button" title={title} onClick={onClick} disabled={disabled} className="p-2 rounded-xl text-ink/60 hover:text-ink hover:bg-black/[0.04] disabled:opacity-40">
      {children}
    </button>
  );

const OpenTrip = ({ id }) => (
  <Link to={`/trip-builder/${id}`} title="Open trip" className="p-2 rounded-xl text-ink/50 hover:text-ink hover:bg-black/[0.04]">
    <ArrowRight className="w-4 h-4" />
  </Link>
);

function DriverForm({ cab, onSave, onCancel }) {
  const [f, setF] = useState({ driver_name: cab.driver_name || "", driver_phone: cab.driver_phone || "", vehicle_number: cab.vehicle_number || "", all: true });
  const [busy, setBusy] = useState(false);
  const input = "w-full rounded-lg border border-black/10 px-2.5 py-1.5 text-sm";
  return (
    <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
      <input className={input} placeholder="Driver name" value={f.driver_name} onChange={(e) => setF({ ...f, driver_name: e.target.value })} />
      <input className={input} placeholder="Driver phone" inputMode="tel" value={f.driver_phone} onChange={(e) => setF({ ...f, driver_phone: e.target.value })} />
      <input className={input} placeholder="Vehicle no." value={f.vehicle_number} onChange={(e) => setF({ ...f, vehicle_number: e.target.value })} />
      <label className="text-xs text-[#5b6472] flex items-center gap-2 sm:col-span-2">
        <input type="checkbox" checked={f.all} onChange={(e) => setF({ ...f, all: e.target.checked })} /> Same driver for every day of this cab
      </label>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm text-[#5b6472]">
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onSave(f);
            setBusy(false);
          }}
          className="px-3 py-1.5 rounded-lg bg-brand text-white text-sm font-semibold disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save driver"}
        </button>
      </div>
    </div>
  );
}

export default function Operations() {
  const { token } = useAuth();
  const today = useMemo(() => localYmd(new Date()), []);
  const [date, setDate] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [editingCab, setEditingCab] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchOperations(token, { from: date, days: 1 }));
    } catch (err) {
      toast.error(err?.message || "Couldn't load operations");
    } finally {
      setLoading(false);
    }
  }, [token, date]);

  useEffect(() => {
    load();
  }, [load]);

  const day = data?.days?.[0] || { arrivals: [], departures: [], checkins: [], checkouts: [], cabs: [] };
  const strip = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  const act = async (key, fn) => {
    setBusyKey(key);
    try {
      await fn();
    } catch (err) {
      toast.error(err?.message || "That didn't work");
    } finally {
      setBusyKey("");
    }
  };

  const request = (c, { whatsapp = false } = {}) =>
    act(`${c.kind}-${c.id}`, async () => {
      // WhatsApp: open the window inside the tap (popup blockers), fill it after.
      const win = whatsapp ? window.open("about:blank", "_blank") : null;
      const res = await requestSupplierConfirmations(token, c.trip.trip_id, {
        kinds: [c.kind],
        ids: { [c.kind]: [c.id] },
        email: !whatsapp,
        force: c.status === "changed" || c.status === "declined",
      });
      const row = (res.requests || [])[0];
      if (whatsapp) {
        if (row?.whatsapp_url && win) win.location.href = row.whatsapp_url;
        else {
          win?.close();
          if (row?.link) {
            await navigator.clipboard?.writeText(row.link).catch(() => {});
            toast.info("No supplier phone saved — confirm link copied instead.");
          }
        }
      } else {
        toast.success(row?.emailed ? `Request emailed to ${row.email}` : res.message);
      }
      load();
    });

  const markConfirmed = (c) =>
    act(`${c.kind}-${c.id}-ok`, async () => {
      await updateBooking(token, c.trip.trip_id, { kind: c.kind, id: c.id, status: "confirmed" });
      toast.success("Marked confirmed");
      load();
    });

  const saveDriver = async (cab, f) => {
    try {
      await updateBooking(token, cab.trip.trip_id, {
        kind: "cab",
        id: cab.id,
        group: f.all,
        ...(f.all ? {} : { date }),
        driver_name: f.driver_name,
        driver_phone: f.driver_phone,
        vehicle_number: f.vehicle_number,
      });
      toast.success("Driver saved");
      setEditingCab(null);
      load();
    } catch (err) {
      toast.error(err?.message || "Couldn't save the driver");
    }
  };

  const stats = [
    ["Arrivals", day.arrivals.length, PlaneLanding],
    ["Departures", day.departures.length, PlaneTakeoff],
    ["Check-ins", day.checkins.length, BedDouble],
    ["Cabs", `${day.cabs.length}${day.cabs.filter((c) => !c.driver_name).length ? ` · ${day.cabs.filter((c) => !c.driver_name).length} no driver` : ""}`, Car],
    ["To confirm", data?.confirmations?.length || 0, MailCheck],
    ["Balance due", data?.unpaid?.length || 0, Wallet],
  ];

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div className="flex flex-wrap items-end gap-3 justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-ink">Daily Operations</h1>
            <p className="text-sm text-[#5b6472]">Arrivals, check-ins, cabs and drivers — and what suppliers still have to confirm.</p>
          </div>
          <button type="button" onClick={load} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-black/10 text-sm font-semibold text-ink hover:bg-black/[0.03]">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {strip.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDate(d)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold border transition ${
                d === date ? "bg-brand text-white border-brand" : "bg-white text-[#3a4250] border-black/10 hover:bg-black/[0.03]"
              }`}
            >
              {dayLabel(d, today)}
            </button>
          ))}
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="shrink-0 px-3 py-2 rounded-full border border-black/10 text-sm bg-white"
            aria-label="Pick a date"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {stats.map(([label, value, icon]) => (
            <div key={label} className="bg-white rounded-2xl border border-black/5 shadow-sm p-4">
              {React.createElement(icon, { className: "w-4 h-4 text-ink/50" })}
              <div className="mt-2 text-xl font-semibold text-ink">{loading && !data ? "—" : value}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#8a93a2]">{label}</div>
            </div>
          ))}
        </div>

        {loading && !data ? (
          <div className="grid place-items-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-ink/40" />
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-5">
            <Card title={`Arrivals · ${dayLabel(date, today)}`} icon={PlaneLanding} count={day.arrivals.length} empty="No one arrives this day.">
              {day.arrivals.map((t) => (
                <div key={t.trip_id} className="px-5 py-3 flex items-center gap-2">
                  <TripLine trip={t} />
                  {waUrl(t.client_phone, "") && (
                    <IconBtn title="WhatsApp the client" href={waUrl(t.client_phone, `Hi ${t.client_name || ""}, welcome! We're all set for your ${t.title} trip.`)}>
                      <MessageCircle className="w-4 h-4 text-[#25D366]" />
                    </IconBtn>
                  )}
                  <OpenTrip id={t.trip_id} />
                </div>
              ))}
            </Card>

            <Card title={`Departures · ${dayLabel(date, today)}`} icon={PlaneTakeoff} count={day.departures.length} empty="No departures this day.">
              {day.departures.map((t) => (
                <div key={t.trip_id} className="px-5 py-3 flex items-center gap-2">
                  <TripLine trip={t} />
                  <OpenTrip id={t.trip_id} />
                </div>
              ))}
            </Card>

            <Card title="Hotel check-ins" icon={BedDouble} count={day.checkins.length} empty="No check-ins this day.">
              {day.checkins.map((h) => (
                <div key={h.id} className="px-5 py-3 flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-ink truncate">
                      {h.hotel} <span className="font-normal text-[#5b6472]">· {h.city}</span>
                    </div>
                    <div className="text-xs text-[#5b6472] truncate">
                      {h.trip.client_name} · {h.rooms || 1} × {h.room_type || "room"} · {h.meal_plan} · until {shortDate(h.check_out)}
                      {h.reference ? ` · ref ${h.reference}` : ""}
                    </div>
                  </div>
                  <SupplierChip status={h.status} />
                  <OpenTrip id={h.trip.trip_id} />
                </div>
              ))}
            </Card>

            <Card title="Cabs & drivers" icon={Car} count={day.cabs.length} empty="No cabs booked this day.">
              {day.cabs.map((c) => {
                const text = `Hi ${c.trip.client_name || ""}, your driver for ${dayLabel(date, today).toLowerCase()} (${shortDate(date)}): ${c.driver_name}${c.driver_phone ? `, ${c.driver_phone}` : ""}${c.vehicle ? ` — ${c.vehicle}` : ""}${c.vehicle_number ? ` ${c.vehicle_number}` : ""}. Route: ${c.route}. Have a great day!`;
                return (
                  <div key={c.id} className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-ink truncate">
                          {c.route || "Cab"} <span className="font-normal text-[#5b6472]">· {c.vehicle}</span>
                        </div>
                        <div className="text-xs text-[#5b6472] truncate">
                          {c.trip.client_name} · {c.trip.guests} pax ·{" "}
                          {c.driver_name ? (
                            <span className="text-ink font-medium">
                              <UserRound className="inline w-3 h-3 -mt-0.5" /> {c.driver_name} {c.driver_phone} {c.vehicle_number}
                            </span>
                          ) : (
                            <span className="text-amber-700 font-semibold">No driver yet</span>
                          )}
                        </div>
                      </div>
                      <button type="button" onClick={() => setEditingCab(editingCab === c.id ? null : c.id)} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-black/10 hover:bg-black/[0.03]">
                        {c.driver_name ? "Change" : "Assign"}
                      </button>
                      {c.driver_brief_url && (
                        <a
                          href={c.driver_brief_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Send the driver the trip brief (guest, dates, day-wise route, hotels)"
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-black/10 hover:bg-black/[0.03] whitespace-nowrap"
                        >
                          Brief driver
                        </a>
                      )}
                      {c.driver_name && waUrl(c.trip.client_phone, text) && (
                        <IconBtn title="Send driver details to the client" href={waUrl(c.trip.client_phone, text)}>
                          <MessageCircle className="w-4 h-4 text-[#25D366]" />
                        </IconBtn>
                      )}
                      <OpenTrip id={c.trip.trip_id} />
                    </div>
                    {editingCab === c.id && <DriverForm cab={c} onCancel={() => setEditingCab(null)} onSave={(f) => saveDriver(c, f)} />}
                  </div>
                );
              })}
            </Card>

            <div className="lg:col-span-2">
              <Card title="Waiting for supplier confirmation · next 30 days" icon={Clock} count={data?.confirmations?.length || 0} empty="Every hotel and cab in the next 30 days is confirmed. 🎉">
                {(data?.confirmations || []).map((c) => {
                  const key = `${c.kind}-${c.id}`;
                  return (
                    <div key={key} className="px-5 py-3 flex flex-wrap items-center gap-2">
                      {c.kind === "hotel" ? <BedDouble className="w-4 h-4 text-ink/40" /> : <Car className="w-4 h-4 text-ink/40" />}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-ink truncate">
                          {c.name} <span className="font-normal text-[#5b6472]">· {shortDate(c.date)}{c.days ? ` · ${c.days} days` : ""}</span>
                        </div>
                        <div className="text-xs text-[#5b6472] truncate">
                          {c.trip.client_name} · {c.trip.trip_id}
                          {c.requested_at ? ` · asked ${shortDate(c.requested_at.slice(0, 10))}` : ""}
                          {!c.email && !c.phone ? " · no supplier email/phone saved" : ""}
                        </div>
                      </div>
                      <SupplierChip status={c.status} />
                      <button
                        type="button"
                        disabled={busyKey === key || !c.email}
                        title={c.email ? `Email ${c.email}` : "No email saved for this supplier"}
                        onClick={() => request(c)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-black/10 hover:bg-black/[0.03] disabled:opacity-40"
                      >
                        {busyKey === key ? "…" : c.status === "requested" ? "Remind" : "Email request"}
                      </button>
                      <IconBtn title={c.phone ? "Send on WhatsApp" : "Copy the confirm link"} onClick={() => request(c, { whatsapp: true })} disabled={busyKey === key}>
                        {c.phone ? <MessageCircle className="w-4 h-4 text-[#25D366]" /> : <Copy className="w-4 h-4" />}
                      </IconBtn>
                      <IconBtn title="Mark confirmed" onClick={() => markConfirmed(c)} disabled={busyKey === `${key}-ok`}>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      </IconBtn>
                      <OpenTrip id={c.trip.trip_id} />
                    </div>
                  );
                })}
              </Card>
            </div>

            <div className="lg:col-span-2">
              <Card title="Balance due · trips in the next 30 days" icon={Wallet} count={data?.unpaid?.length || 0} empty="Nothing outstanding.">
                {(data?.unpaid || []).map((u) => (
                  <div key={u.trip.trip_id} className="px-5 py-3 flex items-center gap-2">
                    <TripLine trip={u.trip} extra={`paid ${money(u.paid)} of ${money(u.cost)}`} />
                    <span className="text-sm font-semibold text-amber-700">{money(u.balance)}</span>
                    <OpenTrip id={u.trip.trip_id} />
                  </div>
                ))}
              </Card>
            </div>

            {day.checkouts.length > 0 && (
              <div className="lg:col-span-2 text-xs text-[#8a93a2] flex items-center gap-2">
                <XCircle className="w-3.5 h-3.5" /> {day.checkouts.length} hotel check-out{day.checkouts.length === 1 ? "" : "s"} this day.
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
