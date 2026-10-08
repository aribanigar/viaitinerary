import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Ticket,
  MapPin,
  Phone,
  Mail,
  CheckCircle2,
  IndianRupee,
  Image as ImageIcon,
  Plus,
  Trash2,
  Users,
  Clock,
  FileText,
} from "lucide-react";
import { PhoneInput } from "react-international-phone";
import "react-international-phone/style.css";
import { toast } from "react-toastify";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import { useAuth } from "../../context/AuthContext";
import { fetchActivity, createActivity, updateActivity } from "../../api/activities";
import { fetchDestinations } from "../../api/destinations";

// Add / edit an activity — laid out like the Accommodation form: details,
// location, supplier & availability, seasonal rates (B2B cost + selling price
// for adults and children), terms, photo.

const ACTIVITY_CATEGORIES = [
  ["sightseeing", "Sightseeing"],
  ["adventure", "Adventure"],
  ["cultural", "Cultural"],
  ["water", "Water"],
  ["snow", "Snow"],
  ["experience", "Experience"],
  ["transfer", "Transfer / Ride"],
  ["other", "Other"],
];

const EMPTY = {
  name: "",
  category: "",
  destination_id: "",
  description: "",
  duration_hours: "",
  city: "",
  state: "",
  country: "",
  address: "",
  supplier_name: "",
  email: "",
  phone: "",
  is_active: true,
  capacity_per_day: "",
  cost: "",
  selling_price: "",
  child_cost: "",
  child_price: "",
  price_sections: [],
  inclusions: "",
  cancellation_policy: "",
  photo: null,
};

const EMPTY_SECTION = { option: "", cost: "", price: "", child_cost: "", child_price: "", valid_from: "", valid_to: "" };

const Label = ({ children }) => (
  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">{children}</label>
);
const inputCls = "w-full px-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 placeholder:text-slate-300 placeholder:font-medium";
const iconInputCls = "w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 placeholder:text-slate-300 placeholder:font-medium";

const Section = ({ icon: Icon, title, action, children }) => (
  <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-4">
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
      <div className="flex items-center gap-2">
        {React.createElement(Icon, { className: "w-4 h-4 text-ink" })}
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">{title}</h3>
      </div>
      {action}
    </div>
    {children}
  </div>
);

const ActivityForm = () => {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const { token } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState(EMPTY);
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchDestinations(token, { per_page: 1000 })
      .then((r) => setDestinations(r.data || []))
      .catch(() => setDestinations([]));
  }, [token]);

  useEffect(() => {
    if (!isEditing || !token) return;
    (async () => {
      try {
        const a = await fetchActivity(id, token);
        const str = (v) => (v === null || v === undefined ? "" : String(v));
        setFormData({
          ...EMPTY,
          name: a.name || "",
          category: a.category || "",
          destination_id: str(a.destination_id),
          description: a.description || "",
          duration_hours: str(a.duration_hours),
          city: a.city || "",
          state: a.state || "",
          country: a.country || "",
          address: a.address || "",
          supplier_name: a.supplier_name || "",
          email: a.email || "",
          phone: a.phone || "",
          is_active: a.is_active !== false,
          capacity_per_day: str(a.capacity_per_day),
          cost: str(a.cost),
          selling_price: str(a.selling_price),
          child_cost: str(a.child_cost),
          child_price: str(a.child_price),
          price_sections: (a.price_sections || []).map((s) => ({ ...EMPTY_SECTION, ...s, valid_from: s.valid_from || "", valid_to: s.valid_to || "" })),
          inclusions: a.inclusions || "",
          cancellation_policy: a.cancellation_policy || "",
          photo: a.image_url || null,
        });
      } catch (err) {
        toast.error(err.message || "Couldn't load this activity");
        navigate("/activities");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEditing, token, navigate]);

  const set = (key, value) => setFormData((prev) => ({ ...prev, [key]: value }));
  const onInput = (e) => set(e.target.name, e.target.value);

  // Picking a destination fills the location the agent hasn't typed yet.
  const onDestination = (e) => {
    const value = e.target.value;
    const d = destinations.find((x) => String(x.id) === value);
    setFormData((prev) => ({
      ...prev,
      destination_id: value,
      city: prev.city || d?.city || d?.name || "",
      state: prev.state || d?.state || "",
      country: prev.country || d?.country || "",
    }));
  };

  const onPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => set("photo", reader.result);
    reader.readAsDataURL(file);
  };

  const updateSection = (i, key, value) =>
    setFormData((prev) => ({ ...prev, price_sections: prev.price_sections.map((s, j) => (j === i ? { ...s, [key]: value } : s)) }));
  const addSection = () => setFormData((prev) => ({ ...prev, price_sections: [...prev.price_sections, { ...EMPTY_SECTION }] }));
  const removeSection = (i) => setFormData((prev) => ({ ...prev, price_sections: prev.price_sections.filter((_, j) => j !== i) }));

  const margin = (() => {
    const c = Number(formData.cost);
    const p = Number(formData.selling_price);
    return c > 0 && p > 0 ? Math.round(((p - c) / p) * 100) : null;
  })();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return toast.error("Give the activity a name");
    if (formData.selling_price === "") return toast.error("Add the selling price per adult");
    const numOrNull = (v) => (v === "" || v === null || v === undefined ? null : Number(v));
    const payload = {
      ...formData,
      price_sections: formData.price_sections
        .filter((s) => s.option || s.price !== "")
        .map((s) => ({
          option: s.option.trim(),
          cost: numOrNull(s.cost),
          price: numOrNull(s.price),
          child_cost: numOrNull(s.child_cost),
          child_price: numOrNull(s.child_price),
          valid_from: s.valid_from || null,
          valid_to: s.valid_to || null,
        })),
    };
    // An unchanged photo is already a stored URL — don't send it back.
    if (typeof payload.photo === "string" && payload.photo.startsWith("http")) delete payload.photo;
    if (!payload.photo) delete payload.photo;
    if (payload.phone && payload.phone.replace(/\D/g, "").length <= 3) payload.phone = "";
    try {
      setSubmitting(true);
      if (isEditing) await updateActivity(id, payload, token);
      else await createActivity(payload, token);
      toast.success(isEditing ? "Activity updated" : "Activity added");
      navigate("/activities");
    } catch (err) {
      toast.error(err.message || "Couldn't save the activity");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <h2 className="font-bold text-lg">{isEditing ? "Edit" : "Add"} Activity</h2>
        <button onClick={() => navigate("/activities")} className="text-sm text-slate-500 hover:text-slate-700">
          Back to list
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm py-12 text-center">Loading...</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <Section icon={Ticket} title="Activity Details">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Activity Name</Label>
                <div className="relative">
                  <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input name="name" value={formData.name} onChange={onInput} className={iconInputCls} placeholder="e.g. Gondola Phase 1" required />
                </div>
              </div>
              <div>
                <Label>Category</Label>
                <select name="category" value={formData.category} onChange={onInput} className={inputCls}>
                  <option value="">Select a category</option>
                  {ACTIVITY_CATEGORIES.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Destination</Label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select name="destination_id" value={formData.destination_id} onChange={onDestination} className={iconInputCls}>
                    <option value="">No destination</option>
                    {destinations.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                        {d.state ? ` — ${d.state}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <Label>Duration (hours)</Label>
                <div className="relative">
                  <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="number" min="0" step="0.5" name="duration_hours" value={formData.duration_hours} onChange={onInput} className={iconInputCls} placeholder="e.g. 3" />
                </div>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <textarea name="description" value={formData.description} onChange={onInput} rows={3} className={inputCls} placeholder="What the guests do, what they see…" />
            </div>
          </Section>

          <Section icon={MapPin} title="Location">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>City</Label>
                <input name="city" value={formData.city} onChange={onInput} className={inputCls} placeholder="e.g. Gulmarg" />
              </div>
              <div>
                <Label>State</Label>
                <input name="state" value={formData.state} onChange={onInput} className={inputCls} placeholder="e.g. Jammu and Kashmir" />
              </div>
              <div>
                <Label>Country</Label>
                <input name="country" value={formData.country} onChange={onInput} className={inputCls} placeholder="e.g. India" />
              </div>
            </div>
            <div>
              <Label>Address / Meeting Point</Label>
              <input name="address" value={formData.address} onChange={onInput} className={inputCls} placeholder="e.g. Gondola base station, Gulmarg" />
            </div>
          </Section>

          <Section icon={Phone} title="Supplier, Availability & Contact">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Availability</Label>
                <button
                  type="button"
                  onClick={() => set("is_active", !formData.is_active)}
                  className={`w-full flex items-center gap-2 pl-4 pr-4 py-3.5 rounded-2xl text-sm font-bold transition-colors ${
                    formData.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {formData.is_active ? "Available" : "Unavailable"}
                </button>
              </div>
              <div>
                <Label>Capacity per Day (persons)</Label>
                <div className="relative">
                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="number" min="0" name="capacity_per_day" value={formData.capacity_per_day} onChange={onInput} className={iconInputCls} placeholder="e.g. 40" />
                </div>
              </div>
              <div>
                <Label>Supplier / Operator</Label>
                <input name="supplier_name" value={formData.supplier_name} onChange={onInput} className={inputCls} placeholder="e.g. JKCCC Gondola" />
              </div>
              <div>
                <Label>Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="email" name="email" value={formData.email} onChange={onInput} className={iconInputCls} placeholder="bookings@operator.com" />
                </div>
              </div>
              <div>
                <Label>Phone Number</Label>
                <div className="relative phone-input-container">
                  <PhoneInput
                    defaultCountry="in"
                    disableCountryGuess
                    forceDialCode
                    value={formData.phone}
                    onChange={(phone) => set("phone", phone)}
                    inputClassName="!w-full !pr-4 !py-3.5 !bg-slate-50 !border-none !rounded-xl !text-sm !font-bold !text-slate-900"
                    containerClassName="!border-none"
                    buttonClassName="!bg-transparent !border-none !rounded-l-xl !pl-4 !mr-[-48px] !z-10"
                  />
                </div>
              </div>
            </div>
          </Section>

          <Section
            icon={IndianRupee}
            title="Pricing (per person)"
            action={
              <button type="button" onClick={addSection} className="flex items-center gap-2 text-sm text-blue-600">
                <Plus className="w-4 h-4" /> Add Seasonal / Option Rate
              </button>
            }
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label>Adult — B2B Cost</Label>
                <input type="number" min="0" name="cost" value={formData.cost} onChange={onInput} className={inputCls} placeholder="₹" />
              </div>
              <div>
                <Label>Adult — Selling Price *</Label>
                <input type="number" min="0" name="selling_price" value={formData.selling_price} onChange={onInput} className={inputCls} placeholder="₹" required />
              </div>
              <div>
                <Label>Child (5–12) — B2B Cost</Label>
                <input type="number" min="0" name="child_cost" value={formData.child_cost} onChange={onInput} className={inputCls} placeholder="₹" />
              </div>
              <div>
                <Label>Child (5–12) — Selling Price</Label>
                <input type="number" min="0" name="child_price" value={formData.child_price} onChange={onInput} className={inputCls} placeholder="₹" />
              </div>
            </div>
            {margin != null && (
              <p className="text-[11px] font-bold text-slate-500 px-1">
                Margin on the adult rate: <span className={margin >= 0 ? "text-emerald-700" : "text-red-600"}>{margin}%</span>
              </p>
            )}

            {formData.price_sections.length > 0 && (
              <div className="space-y-3 pt-2">
                <p className="text-[11px] text-slate-500 px-1">
                  Options or seasons with their own rate (e.g. "Phase 2", "Peak season"). A dated rate is used on the dates it covers; the base rate above applies otherwise.
                </p>
                {formData.price_sections.map((s, i) => (
                  <div key={i} className="rounded-xl bg-slate-50/70 border border-slate-100 p-4 grid grid-cols-2 md:grid-cols-7 gap-3 items-end">
                    <div className="col-span-2 md:col-span-2">
                      <Label>Option / Season</Label>
                      <input value={s.option} onChange={(e) => updateSection(i, "option", e.target.value)} className={inputCls} placeholder="e.g. Phase 2" />
                    </div>
                    <div>
                      <Label>Adult Cost</Label>
                      <input type="number" min="0" value={s.cost ?? ""} onChange={(e) => updateSection(i, "cost", e.target.value)} className={inputCls} placeholder="₹" />
                    </div>
                    <div>
                      <Label>Adult Price</Label>
                      <input type="number" min="0" value={s.price ?? ""} onChange={(e) => updateSection(i, "price", e.target.value)} className={inputCls} placeholder="₹" />
                    </div>
                    <div>
                      <Label>Child Price</Label>
                      <input type="number" min="0" value={s.child_price ?? ""} onChange={(e) => updateSection(i, "child_price", e.target.value)} className={inputCls} placeholder="₹" />
                    </div>
                    <div>
                      <Label>Valid From</Label>
                      <input type="date" value={s.valid_from || ""} onChange={(e) => updateSection(i, "valid_from", e.target.value)} className={inputCls} />
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Label>Valid To</Label>
                        <input type="date" value={s.valid_to || ""} onChange={(e) => updateSection(i, "valid_to", e.target.value)} className={inputCls} />
                      </div>
                      <button type="button" onClick={() => removeSection(i)} title="Remove" className="p-3 text-slate-300 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section icon={FileText} title="Inclusions & Cancellation">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Inclusions (one per line)</Label>
                <textarea name="inclusions" value={formData.inclusions} onChange={onInput} rows={4} className={inputCls} placeholder={"Ticket\nGuide\nSafety gear"} />
              </div>
              <div>
                <Label>Cancellation Policy</Label>
                <textarea name="cancellation_policy" value={formData.cancellation_policy} onChange={onInput} rows={4} className={inputCls} placeholder="e.g. Non-refundable within 24 hours" />
              </div>
            </div>
          </Section>

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
              <ImageIcon className="w-4 h-4 text-ink" />
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">Photo Reference</h3>
            </div>
            <div className="relative w-full h-32 md:h-20 rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1 overflow-hidden">
              {formData.photo ? (
                <img src={formData.photo} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <>
                  <ImageIcon className="w-5 h-5 text-slate-300" />
                  <span className="text-[10px] font-bold text-slate-400 text-center px-4">Upload Activity Photo</span>
                </>
              )}
              <input type="file" onChange={onPhoto} className="absolute inset-0 opacity-0 cursor-pointer" accept=".jpg,.jpeg,.png,.webp" />
            </div>
            <p className="text-[10px] text-slate-500 font-medium mt-2 px-1 text-center md:text-left">Accepted formats: JPG, JPEG, PNG, WebP</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto bg-accent text-ink px-8 py-3.5 rounded-xl font-bold shadow-lg shadow-accent/40 active:scale-[0.98] transition-all"
            >
              {submitting ? "Saving..." : "Save Activity"}
            </button>
            <button type="button" onClick={() => navigate("/activities")} className="w-full sm:w-auto text-slate-600 font-bold py-3.5">
              Cancel
            </button>
          </div>
        </form>
      )}
    </DashboardLayout>
  );
};

export default ActivityForm;
