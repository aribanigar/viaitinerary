import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { BedDouble, Car, CheckCircle2, Copy, Download, Mail, MailCheck, MessageCircle, RefreshCw, Send } from "lucide-react";
import {
  fetchSupplierRequests,
  requestSupplierConfirmations,
  updateBooking,
  downloadVouchersPdf,
} from "../../../api/operations";
import { sendConfirmationEmail } from "../../../api/trips";
import SupplierChip from "../../operations/SupplierChip";

// Logistics tab, saved trips only: supplier confirmations for every hotel and
// cab (request by email / WhatsApp / link, or mark it), the cab's driver, and
// the client's service vouchers. Self-contained — loads its own data and
// reloads after each autosave (`refreshKey`).

const short = (d) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—";
const waUrl = (phone, text) => {
  const d = String(phone || "").replace(/\D/g, "");
  return d.length >= 10 ? `https://wa.me/${d.length === 10 ? `91${d}` : d}?text=${encodeURIComponent(text)}` : null;
};
const saveBlob = (blob, name) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

export default function TripBookings({ token, tripId, refreshKey }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState("");
  const [driverFor, setDriverFor] = useState(null);
  const [driver, setDriver] = useState({ driver_name: "", driver_phone: "", vehicle_number: "" });

  const load = useCallback(async () => {
    if (!token || !tripId) return;
    try {
      setData(await fetchSupplierRequests(token, tripId));
    } catch {
      setData(null);
    }
  }, [token, tripId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  // Ching changed a booking ("send hotel requests", "the driver is …").
  useEffect(() => {
    const onUpdate = () => load();
    window.addEventListener("ching:bookings-updated", onUpdate);
    return () => window.removeEventListener("ching:bookings-updated", onUpdate);
  }, [load]);

  const run = async (key, fn) => {
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      toast.error(err?.message || "That didn't work");
    } finally {
      setBusy("");
    }
  };

  const requestAll = () =>
    run("all", async () => {
      const res = await requestSupplierConfirmations(token, tripId, { kinds: ["hotel", "cab"] });
      toast.success(res.message);
      load();
    });

  const requestOne = (b, whatsapp) =>
    run(`${b.kind}-${b.id}`, async () => {
      const win = whatsapp ? window.open("about:blank", "_blank") : null;
      const res = await requestSupplierConfirmations(token, tripId, {
        kinds: [b.kind],
        ids: { [b.kind]: [b.id] },
        email: !whatsapp,
        force: b.status === "changed" || b.status === "declined",
      });
      const row = (res.requests || [])[0];
      if (whatsapp) {
        if (row?.whatsapp_url && win) win.location.href = row.whatsapp_url;
        else {
          win?.close();
          if (row?.link) await navigator.clipboard?.writeText(row.link).catch(() => {});
          toast.info("No supplier phone saved — confirm link copied.");
        }
      } else toast.success(row?.emailed ? `Emailed ${row.email}` : res.message);
      load();
    });

  const copyLink = (b) =>
    run(`${b.kind}-${b.id}-link`, async () => {
      let link = b.link;
      if (!link) {
        const res = await requestSupplierConfirmations(token, tripId, { kinds: [b.kind], ids: { [b.kind]: [b.id] }, email: false });
        link = res.requests?.[0]?.link;
      }
      if (link) {
        await navigator.clipboard?.writeText(link);
        toast.success("Confirm link copied");
      }
      load();
    });

  const mark = (b, status) =>
    run(`${b.kind}-${b.id}-mark`, async () => {
      const reference = status === "confirmed" && b.kind === "hotel" ? window.prompt("Hotel's confirmation number (optional)", b.reference || "") : undefined;
      if (reference === null) return; // cancelled the prompt
      await updateBooking(token, tripId, { kind: b.kind, id: b.id, status, ...(reference !== undefined ? { reference } : {}) });
      toast.success(status === "confirmed" ? "Marked confirmed" : "Updated");
      load();
    });

  const saveDriver = (cab) =>
    run(`driver-${cab.id}`, async () => {
      await updateBooking(token, tripId, { kind: "cab", id: cab.id, group: true, ...driver });
      toast.success("Driver saved for every day of this cab");
      setDriverFor(null);
      load();
    });

  const vouchers = (how) =>
    run(`vouchers-${how}`, async () => {
      if (how === "download") saveBlob(await downloadVouchersPdf(token, tripId), `${tripId}_Vouchers.pdf`);
      else {
        const res = await sendConfirmationEmail(token, tripId, "vouchers");
        toast.success(res?.message || "Vouchers emailed");
      }
    });

  if (!data) return null;
  const all = [...data.hotels, ...data.cabs];
  if (!all.length) return null;
  const confirmed = all.filter((b) => b.status === "confirmed").length;

  const row = (b) => {
    const key = `${b.kind}-${b.id}`;
    const firstDriver = b.kind === "cab" ? b.days.find((d) => d.driver_name) : null;
    return (
      <div key={key} className="py-3">
        <div className="flex flex-wrap items-center gap-2">
          {b.kind === "hotel" ? <BedDouble className="w-4 h-4 text-ink/40" /> : <Car className="w-4 h-4 text-ink/40" />}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-ink truncate">{b.name}</div>
            <div className="text-xs text-[#5b6472] truncate">
              {b.kind === "hotel" ? `${b.city || ""} · ${short(b.check_in)} – ${short(b.check_out)}` : `${b.days.length} day${b.days.length === 1 ? "" : "s"} from ${short(b.days[0]?.date)}`}
              {b.reference ? ` · ref ${b.reference}` : ""}
              {b.note ? ` · “${b.note}”` : ""}
            </div>
          </div>
          <SupplierChip status={b.status} />
          <button
            type="button"
            title={b.email ? `Email ${b.email}` : "No email saved for this supplier"}
            disabled={!b.email || busy === key}
            onClick={() => requestOne(b, false)}
            className="p-1.5 rounded-lg hover:bg-black/[0.04] disabled:opacity-30"
          >
            <Mail className="w-4 h-4" />
          </button>
          <button type="button" title="Send on WhatsApp" disabled={busy === key} onClick={() => requestOne(b, true)} className="p-1.5 rounded-lg hover:bg-black/[0.04] disabled:opacity-30">
            <MessageCircle className="w-4 h-4 text-[#25D366]" />
          </button>
          <button type="button" title="Copy the confirm link" onClick={() => copyLink(b)} className="p-1.5 rounded-lg hover:bg-black/[0.04]">
            <Copy className="w-4 h-4" />
          </button>
          {b.status !== "confirmed" && (
            <button type="button" title="Mark confirmed" onClick={() => mark(b, "confirmed")} className="p-1.5 rounded-lg hover:bg-black/[0.04]">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </button>
          )}
        </div>
        {b.kind === "cab" && (
          <div className="mt-1.5 ml-6 text-xs text-[#5b6472] flex flex-wrap items-center gap-2">
            {firstDriver ? (
              <span>
                Driver: <b className="text-ink">{firstDriver.driver_name}</b> {firstDriver.driver_phone} {firstDriver.vehicle_number}
              </span>
            ) : (
              <span className="text-amber-700 font-semibold">No driver assigned</span>
            )}
            <button
              type="button"
              className="underline font-semibold"
              onClick={() => {
                setDriverFor(driverFor === b.id ? null : b.id);
                setDriver({ driver_name: firstDriver?.driver_name || "", driver_phone: firstDriver?.driver_phone || "", vehicle_number: firstDriver?.vehicle_number || "" });
              }}
            >
              {firstDriver ? "Change" : "Assign"}
            </button>
            {firstDriver && waUrl(data.client_phone, "") && (
              <a
                className="underline font-semibold text-[#128C7E]"
                target="_blank"
                rel="noopener noreferrer"
                href={waUrl(
                  data.client_phone,
                  `Hi ${data.client_name || ""}, your driver: ${firstDriver.driver_name}${firstDriver.driver_phone ? `, ${firstDriver.driver_phone}` : ""} — ${b.name}${firstDriver.vehicle_number ? ` ${firstDriver.vehicle_number}` : ""}. Have a great trip!`,
                )}
              >
                Send to client
              </a>
            )}
            {b.driver_brief_url && (
              <a className="underline font-semibold text-[#128C7E]" target="_blank" rel="noopener noreferrer" href={b.driver_brief_url} title="Guest, phone, dates, day-wise route and hotels — on WhatsApp">
                Brief driver
              </a>
            )}
          </div>
        )}
        {driverFor === b.id && (
          <div className="mt-2 ml-6 grid grid-cols-1 sm:grid-cols-4 gap-2">
            {[
              ["driver_name", "Driver name"],
              ["driver_phone", "Driver phone"],
              ["vehicle_number", "Vehicle no."],
            ].map(([k, label]) => (
              <input
                key={k}
                placeholder={label}
                value={driver[k]}
                onChange={(e) => setDriver({ ...driver, [k]: e.target.value })}
                className="rounded-lg border border-black/10 px-2.5 py-1.5 text-sm"
              />
            ))}
            <button type="button" onClick={() => saveDriver(b)} disabled={busy === `driver-${b.id}`} className="rounded-lg bg-brand text-white text-sm font-semibold px-3 py-1.5 disabled:opacity-50">
              Save
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="bg-white border border-black/5 rounded-2xl p-5 sm:p-6 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <MailCheck className="w-4 h-4 text-ink/60" />
        <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-ink">Bookings & vouchers</h3>
        <span className="text-xs text-[#8a93a2]">
          {confirmed}/{all.length} confirmed
        </span>
        <button type="button" onClick={load} title="Refresh" className="p-1.5 rounded-lg hover:bg-black/[0.04] ml-auto">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={requestAll}
          disabled={busy === "all" || confirmed === all.length}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold disabled:opacity-40"
        >
          <Send className="w-3.5 h-3.5" /> {busy === "all" ? "Sending…" : "Request all confirmations"}
        </button>
      </div>
      <div className="divide-y divide-black/5">{all.map(row)}</div>
      <div className="mt-3 pt-3 border-t border-black/5 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-[#5b6472] mr-1">Client vouchers (hotel + transport, no prices):</span>
        <button type="button" onClick={() => vouchers("download")} disabled={busy === "vouchers-download"} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-black/10 font-semibold hover:bg-black/[0.03]">
          <Download className="w-3.5 h-3.5" /> Download
        </button>
        <button type="button" onClick={() => vouchers("email")} disabled={busy === "vouchers-email"} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-black/10 font-semibold hover:bg-black/[0.03]">
          <Mail className="w-3.5 h-3.5" /> Email to client
        </button>
      </div>
    </section>
  );
}
