import React, { useEffect, useMemo, useState } from "react";
import {
  MessageCircle,
  Copy,
  Send,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Search,
  FileText,
  Package as PackageIcon,
  Eraser,
  Loader2,
  Save,
  RotateCcw,
} from "lucide-react";
import { toast } from "react-toastify";
import DashboardLayout from "./DashboardLayout";
import PageHeader from "../common/PageHeader";
import DatePicker from "../common/DatePicker";
import { useAuth } from "../../context/AuthContext";
import { fetchSettings } from "../../api/settings";
import { fetchTrip, fetchTrips } from "../../api/trips";
import { fetchPackage, fetchPackages } from "../../api/packages";
import {
  DEFAULT_CLOSING,
  DEFAULT_GREETING,
  buildWhatsAppMessage,
  formFromPackage,
  formFromTrip,
  totalTravellers,
  whatsappUrl,
} from "../../utils/whatsappItinerary";

const TEMPLATE_KEY = "whatsappItineraryTemplate";

const loadWording = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(TEMPLATE_KEY) || "null");
    if (saved) return saved;
  } catch {
    // Storage unavailable or corrupt: fall back to defaults.
  }
  return { greeting: DEFAULT_GREETING, closing: DEFAULT_CLOSING };
};

const emptyDay = () => ({ title: "", route: "", details: "" });

const blankForm = () => ({
  clientName: "",
  clientPhone: "",
  tripTitle: "",
  destination: "",
  adults: 2,
  children: 0,
  nights: 2,
  withDates: false,
  startDate: "",
  currency: "INR (₹)",
  priceMode: "per_person",
  price: "",
  priceNote: "",
  days: [emptyDay(), emptyDay(), emptyDay()],
  hotels: "",
  inclusions: "",
  exclusions: "",
  showHotels: true,
  showInclusions: true,
  showExclusions: true,
  ...loadWording(),
});

const inputCls =
  "w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400";
const labelCls = "block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5";
const cardCls = "bg-white border border-slate-200 rounded-2xl p-5 shadow-sm";

const Toggle = ({ checked, onChange, label }) => (
  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="w-4 h-4 accent-blue-600"
    />
    <span className="text-sm font-semibold text-slate-700">{label}</span>
  </label>
);

const WhatsAppItinerary = () => {
  const { token } = useAuth();
  const [form, setForm] = useState(blankForm);
  const [agency, setAgency] = useState({});
  const [source, setSource] = useState("blank");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loadingId, setLoadingId] = useState(null);
  const [loadedFrom, setLoadedFrom] = useState("");

  useEffect(() => {
    if (!token) return;
    fetchSettings(token)
      .then((data) => setAgency(data || {}))
      .catch(() => toast.error("Could not load agency details for the sign-off"));
  }, [token]);

  // Search trips or packages to start from.
  useEffect(() => {
    if (!token || source === "blank") return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        if (source === "trip") {
          const resp = await fetchTrips(token, { page: 1, per_page: 15, search });
          if (!cancelled) setResults(resp?.data || []);
        } else {
          const resp = await fetchPackages(token, { search });
          if (!cancelled) setResults(resp?.data || []);
        }
      } catch (err) {
        if (!cancelled) {
          setResults([]);
          toast.error(err.message || "Failed to load list");
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [token, source, search]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const setDay = (index, key, value) =>
    setForm((f) => ({
      ...f,
      days: f.days.map((d, i) => (i === index ? { ...d, [key]: value } : d)),
    }));

  const moveDay = (index, delta) =>
    setForm((f) => {
      const days = [...f.days];
      const target = index + delta;
      if (target < 0 || target >= days.length) return f;
      [days[index], days[target]] = [days[target], days[index]];
      return { ...f, days };
    });

  const removeDay = (index) =>
    setForm((f) => ({ ...f, days: f.days.filter((_, i) => i !== index) }));

  const addDay = () => setForm((f) => ({ ...f, days: [...f.days, emptyDay()] }));

  // Days count follows nights (N nights = N+1 days) when the agent asks for it.
  const matchDaysToNights = () =>
    setForm((f) => {
      const want = Math.max(1, (Number(f.nights) || 0) + 1);
      const days = f.days.slice(0, want);
      while (days.length < want) days.push(emptyDay());
      return { ...f, days };
    });

  const pax = totalTravellers(form);

  // Switching price mode converts the amount so the trip value stays the same.
  const changePriceMode = (mode) =>
    setForm((f) => {
      if (mode === f.priceMode) return f;
      const n = totalTravellers(f);
      const price = Number(f.price) || 0;
      let next = f.price;
      if (price > 0 && n > 0) {
        next = Math.round(mode === "per_person" ? price / n : price * n);
      }
      return { ...f, priceMode: mode, price: next };
    });

  const loadItem = async (item) => {
    setLoadingId(item.id);
    try {
      const keep = { greeting: form.greeting, closing: form.closing };
      if (source === "trip") {
        const trip = await fetchTrip(token, item.trip_id || item.id);
        setForm({ ...blankForm(), ...formFromTrip(trip), ...keep });
        setLoadedFrom(`Trip: ${trip.trip_title || trip.trip_id || item.id}`);
      } else {
        const pkg = await fetchPackage(token, item.trip_id || item.id);
        setForm({ ...blankForm(), ...formFromPackage(pkg), ...keep });
        setLoadedFrom(`Package: ${pkg.trip_title || pkg.trip_id}`);
      }
      toast.success("Details loaded. Review and send.");
    } catch (err) {
      toast.error(err.message || "Failed to load details");
    } finally {
      setLoadingId(null);
    }
  };

  const resetAll = () => {
    setForm(blankForm());
    setLoadedFrom("");
  };

  const saveWording = () => {
    try {
      localStorage.setItem(
        TEMPLATE_KEY,
        JSON.stringify({ greeting: form.greeting, closing: form.closing }),
      );
      toast.success("Message wording saved as your template");
    } catch {
      toast.error("Could not save on this browser");
    }
  };

  const restoreWording = () =>
    setForm((f) => ({ ...f, greeting: DEFAULT_GREETING, closing: DEFAULT_CLOSING }));

  const message = useMemo(() => buildWhatsAppMessage(form, agency), [form, agency]);

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Message copied");
    } catch {
      toast.error("Copy failed. Select the text and copy it manually.");
    }
  };

  const openWhatsApp = () => {
    window.open(whatsappUrl(form.clientPhone, message), "_blank", "noopener");
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="WhatsApp Itinerary"
        description="Build a day-wise itinerary message and send it to your client on WhatsApp."
      >
        <button
          onClick={resetAll}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-bold text-sm"
        >
          <Eraser className="w-4 h-4" />
          Clear
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px] gap-6 items-start">
        <div className="space-y-5 min-w-0">
          {/* Start from */}
          <div className={cardCls}>
            <h2 className="text-base font-black text-slate-900 mb-3">Start from</h2>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "blank", label: "Blank", icon: <FileText className="w-4 h-4" /> },
                { id: "trip", label: "A saved trip", icon: <FileText className="w-4 h-4" /> },
                { id: "package", label: "A package", icon: <PackageIcon className="w-4 h-4" /> },
              ].map(({ id, label, icon }) => (
                <button
                  key={id}
                  onClick={() => {
                    setSource(id);
                    setSearch("");
                    setResults([]);
                  }}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold border transition-all ${
                    source === id
                      ? "bg-[#10182A] text-white border-[#10182A]"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>

            {source !== "blank" && (
              <div className="mt-4">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={source === "trip" ? "Search trips by client, title or ID" : "Search packages"}
                    className={`${inputCls} pl-10`}
                  />
                </div>
                <div className="mt-2 max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
                  {searching ? (
                    <div className="p-4 text-sm text-slate-400 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                    </div>
                  ) : results.length === 0 ? (
                    <div className="p-4 text-sm text-slate-400">Nothing found.</div>
                  ) : (
                    results.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => loadItem(item)}
                        disabled={loadingId != null}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center justify-between gap-3 disabled:opacity-60"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">
                            {item.trip_title || item.trip_id}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {source === "trip"
                              ? [item.client_name, item.trip_id, item.duration ? `${item.duration}N` : null]
                                  .filter(Boolean)
                                  .join(" · ")
                              : [item.destination, item.trip_id, item.duration ? `${item.duration}N` : null]
                                  .filter(Boolean)
                                  .join(" · ")}
                          </p>
                        </div>
                        {loadingId === item.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
                        ) : (
                          <span className="text-xs font-bold text-blue-600 shrink-0">Use</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
            {loadedFrom && (
              <p className="mt-3 text-xs font-semibold text-emerald-700">Loaded from {loadedFrom}</p>
            )}
          </div>

          {/* Client & trip */}
          <div className={cardCls}>
            <h2 className="text-base font-black text-slate-900 mb-4">Client &amp; trip</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Client name</label>
                <input className={inputCls} value={form.clientName} onChange={(e) => set("clientName", e.target.value)} placeholder="e.g. Rahul Sharma" />
              </div>
              <div>
                <label className={labelCls}>WhatsApp number</label>
                <input className={inputCls} value={form.clientPhone} onChange={(e) => set("clientPhone", e.target.value)} placeholder="With country code, e.g. 919876543210" />
              </div>
              <div>
                <label className={labelCls}>Trip title</label>
                <input className={inputCls} value={form.tripTitle} onChange={(e) => set("tripTitle", e.target.value)} placeholder="e.g. Kashmir Honeymoon Tour" />
              </div>
              <div>
                <label className={labelCls}>Destination</label>
                <input className={inputCls} value={form.destination} onChange={(e) => set("destination", e.target.value)} placeholder="e.g. Kashmir" />
              </div>
              <div className="grid grid-cols-3 gap-3 sm:col-span-2">
                <div>
                  <label className={labelCls}>Adults</label>
                  <input type="number" min="0" className={inputCls} value={form.adults} onChange={(e) => set("adults", e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Children</label>
                  <input type="number" min="0" className={inputCls} value={form.children} onChange={(e) => set("children", e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Nights</label>
                  <input type="number" min="0" className={inputCls} value={form.nights} onChange={(e) => set("nights", e.target.value)} />
                </div>
              </div>
              <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
                <p className="text-sm text-slate-500">
                  <span className="font-bold text-slate-800">{Math.max(0, Number(form.nights) || 0)}N / {Math.max(0, Number(form.nights) || 0) + 1}D</span>
                  {" · "}
                  <span className="font-bold text-slate-800">{pax}</span> traveller{pax === 1 ? "" : "s"}
                </p>
                <Toggle checked={form.withDates} onChange={(v) => set("withDates", v)} label="Include travel dates" />
              </div>
              {form.withDates && (
                <div>
                  <label className={labelCls}>Start date</label>
                  <DatePicker value={form.startDate} dateFormat="d-m-Y" onChange={(v) => set("startDate", v || "")} />
                </div>
              )}
            </div>
          </div>

          {/* Price */}
          <div className={cardCls}>
            <h2 className="text-base font-black text-slate-900 mb-4">Price</h2>
            <div className="inline-flex p-1 bg-slate-100 rounded-xl mb-4">
              {[
                { id: "per_person", label: "Per person" },
                { id: "total", label: "Total" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => changePriceMode(m.id)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                    form.priceMode === m.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Currency</label>
                <input className={inputCls} value={form.currency} onChange={(e) => set("currency", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>{form.priceMode === "per_person" ? "Price per person" : "Total price"}</label>
                <input type="number" min="0" className={inputCls} value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="Leave empty to hide" />
              </div>
              <div>
                <label className={labelCls}>Price note</label>
                <input className={inputCls} value={form.priceNote} onChange={(e) => set("priceNote", e.target.value)} placeholder="e.g. Inclusive of GST" />
              </div>
            </div>
          </div>

          {/* Days */}
          <div className={cardCls}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="text-base font-black text-slate-900">Day-wise plan</h2>
              <div className="flex gap-2">
                <button onClick={matchDaysToNights} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50">
                  Match to {Math.max(0, Number(form.nights) || 0) + 1} days
                </button>
                <button onClick={addDay} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-accent text-white hover:bg-accent-hover">
                  <Plus className="w-3.5 h-3.5" /> Add day
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {form.days.map((day, index) => (
                <div key={index} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1">
                      Day {index + 1}
                    </span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => moveDay(index, -1)} disabled={index === 0} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white disabled:opacity-30" title="Move up">
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button onClick={() => moveDay(index, 1)} disabled={index === form.days.length - 1} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white disabled:opacity-30" title="Move down">
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button onClick={() => removeDay(index)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-white" title="Remove day">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input className={inputCls} value={day.title} onChange={(e) => setDay(index, "title", e.target.value)} placeholder="Title, e.g. Arrival in Srinagar" />
                    <input className={inputCls} value={day.route} onChange={(e) => setDay(index, "route", e.target.value)} placeholder="Route, e.g. Airport → Srinagar" />
                    <textarea rows={3} className={`${inputCls} sm:col-span-2 resize-y`} value={day.details} onChange={(e) => setDay(index, "details", e.target.value)} placeholder="One activity per line" />
                  </div>
                </div>
              ))}
              {form.days.length === 0 && <p className="text-sm text-slate-400">No days yet. Add one.</p>}
            </div>
          </div>

          {/* Extras */}
          <div className={cardCls}>
            <h2 className="text-base font-black text-slate-900 mb-4">Hotels, inclusions &amp; exclusions</h2>
            <div className="space-y-4">
              {[
                { key: "hotels", show: "showHotels", label: "Hotels", ph: "e.g. Srinagar: Hotel Grand (2N, MAP)" },
                { key: "inclusions", show: "showInclusions", label: "Inclusions", ph: "One item per line" },
                { key: "exclusions", show: "showExclusions", label: "Exclusions", ph: "One item per line" },
              ].map((s) => (
                <div key={s.key}>
                  <div className="mb-1.5">
                    <Toggle checked={form[s.show]} onChange={(v) => set(s.show, v)} label={`Show ${s.label.toLowerCase()}`} />
                  </div>
                  {form[s.show] && (
                    <textarea rows={3} className={`${inputCls} resize-y`} value={form[s.key]} onChange={(e) => set(s.key, e.target.value)} placeholder={s.ph} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Wording template */}
          <div className={cardCls}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <h2 className="text-base font-black text-slate-900">Message wording</h2>
              <div className="flex gap-2">
                <button onClick={restoreWording} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50">
                  <RotateCcw className="w-3.5 h-3.5" /> Default
                </button>
                <button onClick={saveWording} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#10182A] text-white hover:bg-slate-800">
                  <Save className="w-3.5 h-3.5" /> Save as template
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Placeholders: {"{name}"}, {"{agencyName}"}, {"{tripTitle}"}, {"{destination}"}. The message always opens with "Dear {"{name}"}," and ends with your agency details from Settings.
            </p>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Opening line</label>
                <textarea rows={2} className={`${inputCls} resize-y`} value={form.greeting} onChange={(e) => set("greeting", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Closing line</label>
                <textarea rows={2} className={`${inputCls} resize-y`} value={form.closing} onChange={(e) => set("closing", e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="xl:sticky xl:top-0 space-y-3 min-w-0">
          <div className="bg-[#EFEAE2] border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-[#075E54] text-white px-4 py-3 flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              <span className="font-bold text-sm truncate">{form.clientName || "Client"}</span>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              <div className="bg-[#D9FDD3] rounded-xl rounded-tr-none px-3.5 py-2.5 shadow-sm text-[13px] leading-relaxed text-slate-900 whitespace-pre-wrap break-words">
                {message}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={copyMessage} className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 text-slate-800 rounded-xl hover:bg-slate-50 font-bold text-sm">
              <Copy className="w-4 h-4" /> Copy text
            </button>
            <button onClick={openWhatsApp} className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#25D366] text-white rounded-xl hover:bg-[#1ebe5b] font-bold text-sm">
              <Send className="w-4 h-4" /> Send on WhatsApp
            </button>
          </div>
          {!form.clientPhone && (
            <p className="text-xs text-slate-500">No number added: WhatsApp will ask you to pick a chat.</p>
          )}
          <p className="text-xs text-slate-400">{message.length.toLocaleString()} characters. Words between *stars* show in bold on WhatsApp.</p>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default WhatsAppItinerary;
