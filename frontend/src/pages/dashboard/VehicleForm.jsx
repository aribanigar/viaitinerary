import React, { useState, useEffect, useMemo } from "react";
import { Country, State } from "country-state-city";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";
import { fetchVehicle, createVehicle, updateVehicle } from "../../api/vehicles";
import {
  Car,
  MapPin,
  Mail,
  ImageIcon,
  Plus,
  Map,
  Globe2,
  CheckCircle2,
  Users,
  Briefcase,
  Fuel,
  Hash,
  IndianRupee,
  Route,
  Wind,
  Clock,
  Moon,
  ParkingSquare,
  Sparkles,
  StickyNote,
} from "lucide-react";
import { PhoneInput } from "react-international-phone";
import "react-international-phone/style.css";

const VEHICLE_TYPES = [
  { value: "hatchback", label: "Hatchback" },
  { value: "sedan", label: "Sedan" },
  { value: "suv", label: "SUV" },
  { value: "tempo_traveller", label: "Tempo Traveller" },
  { value: "mini_bus", label: "Mini Bus" },
  { value: "luxury_bus", label: "Luxury Bus" },
  { value: "other", label: "Other" },
];

const FUEL_TYPES = [
  { value: "petrol", label: "Petrol" },
  { value: "diesel", label: "Diesel" },
  { value: "cng", label: "CNG" },
  { value: "electric", label: "Electric" },
  { value: "hybrid", label: "Hybrid" },
];

const RATE_TYPES = [
  { value: "per_day", label: "Per Day" },
  { value: "per_km", label: "Per KM" },
  { value: "per_trip", label: "Per Trip" },
];

const FEATURE_PRESETS = [
  "AC",
  "Music System",
  "USB Charging",
  "GPS Tracking",
  "First Aid Kit",
  "Water Bottles",
  "Reclining Seats",
  "Extra Legroom",
];

const VehicleForm = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    vehicle_type: "",
    registration_number: "",
    seating_capacity: "",
    luggage_capacity: "",
    fuel_type: "",
    is_ac: "",
    city: "",
    state: "",
    country: "",
    is_available: true,
    email: "",
    phone: "",
    rate_type: "per_day",
    price: "",
    min_km_per_day: "",
    extra_km_rate: "",
    extra_hour_rate: "",
    driver_allowance: "",
    night_halt_charges: "",
    toll_parking_included: "",
    notes: "",
    photo: null,
  });

  const [features, setFeatures] = useState([]);
  const [customFeature, setCustomFeature] = useState("");

  const [countryIso, setCountryIso] = useState("");
  const [stateIso, setStateIso] = useState("");
  const [cities, setCities] = useState([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const countries = useMemo(() => Country.getAllCountries(), []);
  const states = useMemo(
    () => (countryIso ? State.getStatesOfCountry(countryIso) : []),
    [countryIso],
  );

  useEffect(() => {
    if (!countryIso || !stateIso) {
      setCities([]);
      return;
    }
    let cancelled = false;
    setCitiesLoading(true);
    import("country-state-city/lib/city")
      .then((mod) => {
        if (cancelled) return;
        setCities(mod.default.getCitiesOfState(countryIso, stateIso) || []);
      })
      .finally(() => {
        if (!cancelled) setCitiesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [countryIso, stateIso]);

  const resolveLocationCodes = (countryName, stateName) => {
    if (!countryName) return { countryIso: "", stateIso: "" };
    const country = Country.getAllCountries().find(
      (c) => c.name.toLowerCase() === countryName.toLowerCase(),
    );
    if (!country) return { countryIso: "", stateIso: "" };
    let matchedStateIso = "";
    if (stateName) {
      const match = State.getStatesOfCountry(country.isoCode).find(
        (s) => s.name.toLowerCase() === stateName.toLowerCase(),
      );
      if (match) matchedStateIso = match.isoCode;
    }
    return { countryIso: country.isoCode, stateIso: matchedStateIso };
  };

  const handleCountrySelect = (e) => {
    const iso = e.target.value;
    const country = countries.find((c) => c.isoCode === iso);
    setCountryIso(iso);
    setStateIso("");
    setFormData((prev) => ({ ...prev, country: country?.name || "", state: "", city: "" }));
  };

  const handleStateSelect = (e) => {
    const iso = e.target.value;
    const state = states.find((s) => s.isoCode === iso);
    setStateIso(iso);
    setFormData((prev) => ({ ...prev, state: state?.name || "", city: "" }));
  };

  const handleCitySelect = (e) => {
    setFormData((prev) => ({ ...prev, city: e.target.value }));
  };

  useEffect(() => {
    if (isEditing && token) {
      (async () => {
        try {
          setLoading(true);
          const resp = await fetchVehicle(id, token);
          setFormData({
            name: resp.name || "",
            vehicle_type: resp.vehicle_type || "",
            registration_number: resp.registration_number || "",
            seating_capacity: resp.seating_capacity != null ? String(resp.seating_capacity) : "",
            luggage_capacity: resp.luggage_capacity != null ? String(resp.luggage_capacity) : "",
            fuel_type: resp.fuel_type || "",
            is_ac: resp.is_ac == null ? "" : resp.is_ac,
            city: resp.city || "",
            state: resp.state || "",
            country: resp.country || "",
            is_available: resp.is_available ?? true,
            email: resp.email || "",
            phone: resp.phone || "",
            rate_type: resp.rate_type || "per_day",
            price: resp.price != null ? String(resp.price) : "",
            min_km_per_day: resp.min_km_per_day != null ? String(resp.min_km_per_day) : "",
            extra_km_rate: resp.extra_km_rate != null ? String(resp.extra_km_rate) : "",
            extra_hour_rate: resp.extra_hour_rate != null ? String(resp.extra_hour_rate) : "",
            driver_allowance: resp.driver_allowance != null ? String(resp.driver_allowance) : "",
            night_halt_charges: resp.night_halt_charges != null ? String(resp.night_halt_charges) : "",
            toll_parking_included: resp.toll_parking_included == null ? "" : resp.toll_parking_included,
            notes: resp.notes || "",
            photo: resp.image_url || null,
          });
          setFeatures(Array.isArray(resp.features) ? resp.features : []);
          const codes = resolveLocationCodes(resp.country, resp.state);
          setCountryIso(codes.countryIso);
          setStateIso(codes.stateIso);
        } catch (err) {
          toast.error(err.message || "Failed to load vehicle");
        } finally {
          setLoading(false);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, id, token]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, photo: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleFeature = (feature) => {
    setFeatures((prev) =>
      prev.includes(feature) ? prev.filter((f) => f !== feature) : [...prev, feature],
    );
  };

  const addCustomFeature = () => {
    const value = customFeature.trim();
    if (!value) return;
    if (!features.includes(value)) setFeatures((prev) => [...prev, value]);
    setCustomFeature("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Vehicle name is required");
      return;
    }
    if (formData.price === "") {
      toast.error("Price is required");
      return;
    }

    try {
      setSubmitting(true);
      const submitData = { ...formData, features };

      if (
        submitData.photo &&
        typeof submitData.photo === "string" &&
        submitData.photo.startsWith("http")
      ) {
        delete submitData.photo;
      }

      if (isEditing) {
        await updateVehicle(id, submitData, token);
        toast.success("Vehicle updated successfully");
      } else {
        await createVehicle(submitData, token);
        toast.success("Vehicle created successfully");
      }

      navigate("/transportation");
    } catch (err) {
      toast.error(err.message || "Error saving vehicle");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <h2 className="font-bold text-lg">{isEditing ? "Edit" : "Add"} Vehicle</h2>
        <div>
          <button
            onClick={() => navigate("/transportation")}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Back to list
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm py-12 text-center">
          Loading...
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Car className="w-4 h-4 text-[#181c22]" />
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">
                Vehicle Details
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">
                  Vehicle Name
                </label>
                <div className="relative">
                  <Car className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    autoComplete="off"
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900"
                    placeholder="e.g. Toyota Innova Crysta"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">
                  Vehicle Type
                </label>
                <select
                  name="vehicle_type"
                  value={formData.vehicle_type}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 appearance-none cursor-pointer"
                >
                  <option value="">Select type…</option>
                  {VEHICLE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">
                  Seating Capacity
                </label>
                <div className="relative">
                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="number"
                    min="0"
                    name="seating_capacity"
                    value={formData.seating_capacity}
                    onChange={handleInputChange}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900"
                    placeholder="e.g. 6"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">
                  Luggage Capacity
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="number"
                    min="0"
                    name="luggage_capacity"
                    value={formData.luggage_capacity}
                    onChange={handleInputChange}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900"
                    placeholder="e.g. 3 bags"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">
                  Fuel Type
                </label>
                <div className="relative">
                  <Fuel className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    name="fuel_type"
                    value={formData.fuel_type}
                    onChange={handleInputChange}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 appearance-none cursor-pointer"
                  >
                    <option value="">Select fuel…</option>
                    {FUEL_TYPES.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">
                  Registration Number
                </label>
                <div className="relative">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    name="registration_number"
                    value={formData.registration_number}
                    onChange={handleInputChange}
                    autoComplete="off"
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 uppercase"
                    placeholder="e.g. RJ14 AB 1234"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">
                  AC / Non-AC
                </label>
                <div className="flex items-center gap-1 bg-slate-50 rounded-2xl p-1.5 w-full">
                  {[
                    { value: true, label: "AC" },
                    { value: false, label: "Non-AC" },
                  ].map((opt) => (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          is_ac: prev.is_ac === opt.value ? "" : opt.value,
                        }))
                      }
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                        formData.is_ac === opt.value
                          ? "bg-[#181c22] text-white"
                          : "text-slate-500"
                      }`}
                    >
                      <Wind className="w-3.5 h-3.5" /> {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <MapPin className="w-4 h-4 text-[#181c22]" />
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">
                Base Location
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">
                  Country
                </label>
                <div className="relative">
                  <Globe2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    value={countryIso}
                    onChange={handleCountrySelect}
                    autoComplete="off"
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 appearance-none cursor-pointer"
                  >
                    <option value="">Select country…</option>
                    {countries.map((c) => (
                      <option key={c.isoCode} value={c.isoCode}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">
                  State / Province
                </label>
                <div className="relative">
                  <Map className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  {countryIso && states.length === 0 ? (
                    <input
                      name="state"
                      value={formData.state}
                      onChange={handleInputChange}
                      autoComplete="off"
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900"
                      placeholder="State / province"
                    />
                  ) : (
                    <select
                      value={stateIso}
                      onChange={handleStateSelect}
                      disabled={!countryIso}
                      autoComplete="off"
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 appearance-none cursor-pointer disabled:cursor-not-allowed disabled:text-slate-400"
                    >
                      <option value="">
                        {countryIso ? "Select state…" : "Select country first"}
                      </option>
                      {states.map((s) => (
                        <option key={s.isoCode} value={s.isoCode}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">
                  City
                </label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  {stateIso && !citiesLoading && cities.length === 0 ? (
                    <input
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      autoComplete="off"
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900"
                      placeholder="City"
                    />
                  ) : (
                    <select
                      value={formData.city}
                      onChange={handleCitySelect}
                      disabled={!stateIso || citiesLoading}
                      autoComplete="off"
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 appearance-none cursor-pointer disabled:cursor-not-allowed disabled:text-slate-400"
                    >
                      <option value="">
                        {citiesLoading
                          ? "Loading cities…"
                          : stateIso
                            ? "Select city…"
                            : "Select state first"}
                      </option>
                      {formData.city && !cities.some((c) => c.name === formData.city) && (
                        <option value={formData.city}>{formData.city}</option>
                      )}
                      {cities.map((c) => (
                        <option key={`${c.name}-${c.latitude}-${c.longitude}`} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <CheckCircle2 className="w-4 h-4 text-[#181c22]" />
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">
                Availability &amp; Contact
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">
                  Availability
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, is_available: !prev.is_available }))
                  }
                  className={`w-full flex items-center gap-2 pl-4 pr-4 py-3.5 rounded-2xl text-sm font-bold transition-colors ${
                    formData.is_available
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {formData.is_available ? "Available" : "Unavailable"}
                </button>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">
                  Toll &amp; Parking
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      toll_parking_included:
                        prev.toll_parking_included === "" ? true : !prev.toll_parking_included,
                    }))
                  }
                  className="w-full flex items-center gap-2 pl-4 pr-4 py-3.5 rounded-2xl text-sm font-bold bg-slate-50 text-slate-700 transition-colors"
                >
                  <ParkingSquare className="w-4 h-4" />
                  {formData.toll_parking_included === ""
                    ? "Not specified"
                    : formData.toll_parking_included
                      ? "Included in rate"
                      : "Charged extra"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900"
                    placeholder="driver@example.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">
                  Phone Number
                </label>
                <div className="relative phone-input-container">
                  <PhoneInput
                    defaultCountry="in"
                    disableCountryGuess
                    forceDialCode
                    value={formData.phone}
                    onChange={(phone) => setFormData((prev) => ({ ...prev, phone }))}
                    inputClassName="!w-full !pr-4 !py-3.5 !bg-slate-50 !border-none !rounded-xl !text-sm !font-bold !text-slate-900 !focus:ring-2 !focus:ring-[#e7f63c]/20 !transition-all !placeholder:text-slate-300 !placeholder:font-medium"
                    containerClassName="!border-none"
                    buttonClassName="!bg-transparent !border-none !rounded-l-xl !pl-4 !mr-[-48px] !z-10"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <IndianRupee className="w-4 h-4 text-[#181c22]" />
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">
                Rate &amp; Charges
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">
                  Rate Type
                </label>
                <div className="relative">
                  <Route className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    name="rate_type"
                    value={formData.rate_type}
                    onChange={handleInputChange}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 appearance-none cursor-pointer"
                  >
                    {RATE_TYPES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">
                  Base Price (₹)
                </label>
                <div className="relative">
                  <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">
                  Minimum KM / Day
                </label>
                <div className="relative">
                  <Route className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="number"
                    min="0"
                    name="min_km_per_day"
                    value={formData.min_km_per_day}
                    onChange={handleInputChange}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900"
                    placeholder="e.g. 250"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">
                  Extra KM Rate
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="extra_km_rate"
                    value={formData.extra_km_rate}
                    onChange={handleInputChange}
                    className="w-full pl-7 pr-2 py-3 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-900"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">
                  <Clock className="w-3 h-3 inline -mt-0.5 mr-0.5" /> Extra Hour Rate
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="extra_hour_rate"
                    value={formData.extra_hour_rate}
                    onChange={handleInputChange}
                    className="w-full pl-7 pr-2 py-3 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-900"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">
                  Driver Allowance
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="driver_allowance"
                    value={formData.driver_allowance}
                    onChange={handleInputChange}
                    className="w-full pl-7 pr-2 py-3 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-900"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">
                  <Moon className="w-3 h-3 inline -mt-0.5 mr-0.5" /> Night Halt Charges
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="night_halt_charges"
                    value={formData.night_halt_charges}
                    onChange={handleInputChange}
                    className="w-full pl-7 pr-2 py-3 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-900"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Sparkles className="w-4 h-4 text-[#181c22]" />
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">
                Features
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {[...new Set([...FEATURE_PRESETS, ...features])].map((feature) => {
                const active = features.includes(feature);
                return (
                  <button
                    key={feature}
                    type="button"
                    onClick={() => toggleFeature(feature)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                      active
                        ? "bg-[#181c22] text-white"
                        : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    {feature}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customFeature}
                onChange={(e) => setCustomFeature(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomFeature();
                  }
                }}
                className="flex-1 px-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-900"
                placeholder="Add a custom feature…"
              />
              <button
                type="button"
                onClick={addCustomFeature}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <StickyNote className="w-4 h-4 text-[#181c22]" />
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">
                Notes
              </h3>
            </div>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-medium text-slate-900 resize-none"
              placeholder="Anything else worth noting about this vehicle or vendor…"
            />
          </div>

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
              <ImageIcon className="w-4 h-4 text-[#181c22]" />
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">
                Photo Reference
              </h3>
            </div>
            <div className="relative w-full h-32 md:h-20 rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1 overflow-hidden">
              {formData.photo ? (
                <img src={formData.photo} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <>
                  <ImageIcon className="w-5 h-5 text-slate-300" />
                  <span className="text-[10px] font-bold text-slate-400 text-center px-4">
                    Upload Vehicle Photo
                  </span>
                </>
              )}
              <input
                type="file"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
                accept=".jpg,.jpeg,.png,.webp"
              />
            </div>
            <p className="text-[10px] text-slate-500 font-medium mt-2 px-1 text-center md:text-left">
              Accepted formats: JPG, JPEG, PNG, WebP
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto bg-[#e7f63c] text-[#181c22] px-8 py-3.5 rounded-xl font-bold shadow-lg shadow-[#e7f63c]/40 active:scale-[0.98] transition-all"
            >
              {submitting ? "Saving..." : "Save Vehicle"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/transportation")}
              className="w-full sm:w-auto text-slate-600 font-bold py-3.5"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </DashboardLayout>
  );
};

export default VehicleForm;
