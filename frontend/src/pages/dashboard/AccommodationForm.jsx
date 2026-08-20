import React, { useState, useEffect, useRef } from "react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";
import { getHotel, createHotel, updateHotel } from "../../api/hotels";
import {
  Hotel,
  MapPin,
  Mail,
  Phone,
  ImageIcon,
  Plus,
  Trash2,
  Star,
  Map,
  Globe2,
  CheckCircle2,
  BedDouble,
  LocateFixed,
  TrendingUp,
  Wallet,
  Sparkles,
  ExternalLink,
  Building2,
} from "lucide-react";
import { PhoneInput } from "react-international-phone";
import "react-international-phone/style.css";
import { useGoogleMapsScript } from "../../hooks/useGoogleMapsScript";

const AccommodationForm = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    country: "",
    category: "",
    is_available: true,
    total_rooms: "",
    latitude: "",
    longitude: "",
    email: "",
    phone: "",
    photo: null,
  });

  const [priceSections, setPriceSections] = useState([]);
  const [marketPrices, setMarketPrices] = useState([]);
  const [marketPriceDraft, setMarketPriceDraft] = useState({ source: "", price: "", note: "" });
  const [paymentTerms, setPaymentTerms] = useState({ reference_event: "booking_date", installments: [] });
  const [googleRating, setGoogleRating] = useState(null);
  const [fetchingPlace, setFetchingPlace] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const hotelNameInputRef = useRef(null);
  const hotelNameWrapRef = useRef(null);
  const sessionTokenRef = useRef(null);
  const suggestDebounceRef = useRef(null);
  const { loaded: mapsLoaded } = useGoogleMapsScript();

  const roomTypeOptions = ["deluxe", "super_deluxe", "suite"];

  useEffect(() => {
    if (isEditing && token) {
      (async () => {
        try {
          setLoading(true);
          const resp = await getHotel(id, token);

          setFormData({
            name: resp.name || "",
            address: resp.address || "",
            city: resp.city || "",
            state: resp.state || "",
            country: resp.country || "",
            category: resp.category || "",
            is_available: resp.is_available ?? true,
            total_rooms: resp.total_rooms != null ? String(resp.total_rooms) : "",
            latitude: resp.latitude != null ? String(resp.latitude) : "",
            longitude: resp.longitude != null ? String(resp.longitude) : "",
            email: resp.email || "",
            phone: resp.phone || "",
            photo: resp.image_url || null,
          });

          setMarketPrices(resp.market_prices || []);
          setPaymentTerms(
            resp.payment_terms || { reference_event: "booking_date", installments: [] },
          );

          if (resp.price_sections && resp.price_sections.length) {
            setPriceSections(
              resp.price_sections.map((s, idx) => {
                const isCustomRoomType =
                  s.room_type && !roomTypeOptions.includes(s.room_type);

                return {
                  ...s,
                  id: Date.now() + idx,
                  room_type: isCustomRoomType ? "other" : s.room_type,
                  room_type_custom: isCustomRoomType ? s.room_type : "",
                };
              }),
            );
          }
        } catch (err) {
          toast.error(err.message || "Failed to load hotel");
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [id, token]);

  // Fetch a Google Place photo and convert it to a data URL so it flows
  // through the same persistImage path as a manually uploaded photo.
  const applyPlacePhoto = async (place) => {
    const photoRef = place.photos?.[0];
    if (!photoRef) return;
    try {
      const url = photoRef.getURI({ maxWidth: 800, maxHeight: 600 });
      const res = await fetch(url);
      const blob = await res.blob();
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      setFormData((prev) => ({ ...prev, photo: dataUrl }));
    } catch {
      // Photo fetch can fail (CORS, rate limits) — non-fatal, just skip it.
    }
  };

  // Close the suggestions dropdown when clicking outside the Hotel Name field.
  useEffect(() => {
    const onClickOutside = (e) => {
      if (hotelNameWrapRef.current && !hotelNameWrapRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const fetchSuggestions = async (query) => {
    const places = window.google?.maps?.places;
    if (!mapsLoaded || !places?.AutocompleteSuggestion || !query || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    if (!sessionTokenRef.current && places.AutocompleteSessionToken) {
      sessionTokenRef.current = new places.AutocompleteSessionToken();
    }
    try {
      const { suggestions: results } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: query,
        includedPrimaryTypes: ["lodging"],
        sessionToken: sessionTokenRef.current,
      });
      setSuggestions(results || []);
      setShowSuggestions(true);
    } catch {
      setSuggestions([]);
    }
  };

  const handleHotelNameChange = (e) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, name: value }));
    setGoogleRating(null);
    if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    suggestDebounceRef.current = setTimeout(() => fetchSuggestions(value), 250);
  };

  const selectSuggestion = async (suggestion) => {
    setShowSuggestions(false);
    setSuggestions([]);
    const place = suggestion.placePrediction.toPlace();
    setFetchingPlace(true);
    try {
      await place.fetchFields({
        fields: ["displayName", "formattedAddress", "addressComponents", "location", "photos", "rating"],
      });

      const components = place.addressComponents || [];
      const find = (type) => components.find((c) => c.types.includes(type))?.longText || "";

      const city = find("locality") || find("postal_town") || find("administrative_area_level_2");
      const state = find("administrative_area_level_1");
      const country = find("country");
      const lat = typeof place.location?.lat === "function" ? place.location.lat() : place.location?.lat;
      const lng = typeof place.location?.lng === "function" ? place.location.lng() : place.location?.lng;

      setFormData((prev) => ({
        ...prev,
        name: place.displayName || prev.name,
        address: place.formattedAddress || prev.address,
        city: city || prev.city,
        state: state || prev.state,
        country: country || prev.country,
        latitude: lat != null ? String(lat) : prev.latitude,
        longitude: lng != null ? String(lng) : prev.longitude,
      }));

      setGoogleRating(place.rating ?? null);
      await applyPlacePhoto(place);
    } catch {
      toast.error("Couldn't fetch that property's details — you can still fill the fields in manually.");
    } finally {
      setFetchingPlace(false);
      sessionTokenRef.current = null; // start a fresh (billing) session next search
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name.includes("price")
        ? value === ""
          ? ""
          : Number(value)
        : value,
    }));
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

  const updateSection = (index, field, value) => {
    setPriceSections((prev) => {
      const copy = [...prev];
      const nextValue =
        field.includes("price") ||
        field === "cnb" ||
        field === "upto_5" ||
        field === "above_12" ||
        field === "extra_adult"
          ? value === ""
            ? ""
            : Number(value)
          : value;

      copy[index] = {
        ...copy[index],
        [field]: nextValue,
      };

      if (field === "room_type" && value !== "other") {
        copy[index].room_type_custom = "";
      }

      return copy;
    });
  };

  const addSection = (fromIndex) => {
    setPriceSections((prev) => {
      const newSec =
        fromIndex != null
          ? { ...prev[fromIndex], id: Date.now() }
          : {
              id: Date.now(),
              room_type: "",
              room_type_custom: "",
              meal_plan: "",
              price: "",
              cnb: "",
              upto_5: "",
              above_12: "",
              extra_adult: "",
              valid_from: "",
              valid_to: "",
            };
      return [...prev, newSec];
    });
  };

  const removeSection = (index) => {
    setPriceSections((prev) => prev.filter((_, i) => i !== index));
  };

  const addMarketPrice = () => {
    if (!marketPriceDraft.source || !marketPriceDraft.price) return;
    setMarketPrices((prev) => [
      ...prev,
      {
        source: marketPriceDraft.source,
        price: Number(marketPriceDraft.price),
        note: marketPriceDraft.note || "",
        date: new Date().toISOString().slice(0, 10),
      },
    ]);
    setMarketPriceDraft({ source: "", price: "", note: "" });
  };

  const removeMarketPrice = (index) => {
    setMarketPrices((prev) => prev.filter((_, i) => i !== index));
  };

  const marketAverage = marketPrices.length
    ? Math.round(marketPrices.reduce((sum, m) => sum + Number(m.price || 0), 0) / marketPrices.length)
    : null;

  const applySuggestedPrice = () => {
    if (marketAverage == null || priceSections.length === 0) return;
    updateSection(0, "price", marketAverage);
    toast.success(`Applied ₹${marketAverage.toLocaleString("en-IN")} to the first price row`);
  };

  const addInstallment = () => {
    setPaymentTerms((prev) => ({
      ...prev,
      installments: [...prev.installments, { label: "", percentage: "", days_offset: "" }],
    }));
  };

  const updateInstallment = (index, field, value) => {
    setPaymentTerms((prev) => ({
      ...prev,
      installments: prev.installments.map((inst, i) =>
        i === index ? { ...inst, [field]: value } : inst,
      ),
    }));
  };

  const removeInstallment = (index) => {
    setPaymentTerms((prev) => ({
      ...prev,
      installments: prev.installments.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.phone && formData.phone.length < 8) {
      toast.error("Please enter a valid phone number");
      return;
    }

    try {
      setSubmitting(true);
      const submitData = { ...formData };

      submitData.price_sections = priceSections.map((s) => ({
        room_type: s.room_type === "other" ? s.room_type_custom : s.room_type,
        meal_plan: s.meal_plan,
        price: s.price,
        cnb: s.cnb,
        upto_5: s.upto_5,
        above_12: s.above_12,
        extra_adult: s.extra_adult,
        valid_from: s.valid_from || null,
        valid_to: s.valid_to || null,
      }));
      submitData.market_prices = marketPrices;
      submitData.payment_terms =
        paymentTerms.installments.length > 0 ? paymentTerms : null;

      if (
        submitData.photo &&
        typeof submitData.photo === "string" &&
        submitData.photo.startsWith("http")
      ) {
        delete submitData.photo;
      }

      if (isEditing) {
        await updateHotel(id, submitData, token);
        toast.success("Hotel updated successfully");
      } else {
        await createHotel(submitData, token);
        toast.success("Hotel created successfully");
      }

      navigate("/accommodation");
    } catch (err) {
      toast.error(err.message || "Error saving hotel");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden p-6">
        <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
          <h2 className="font-bold text-lg">
            {isEditing ? "Edit" : "Add"} Accommodation
          </h2>
          <div>
            <button
              onClick={() => navigate("/accommodation")}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Back to list
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center">Loading...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">
                  Hotel Name
                  {mapsLoaded && (
                    <span className="inline-flex items-center gap-1 normal-case font-bold text-blue-500 tracking-normal">
                      <LocateFixed className="w-3 h-3" /> Google-assisted
                    </span>
                  )}
                  {fetchingPlace && (
                    <span className="normal-case font-bold text-slate-400 tracking-normal">
                      Fetching details…
                    </span>
                  )}
                </label>
                <div className="relative" ref={hotelNameWrapRef}>
                  <Hotel className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    ref={hotelNameInputRef}
                    name="name"
                    value={formData.name}
                    onChange={handleHotelNameChange}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    autoComplete="off"
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900"
                    placeholder="Start typing a hotel name…"
                    required
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <ul className="absolute z-20 left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                      {suggestions.map((s, idx) => (
                        <li key={s.placePrediction?.placeId || idx}>
                          <button
                            type="button"
                            onClick={() => selectSuggestion(s)}
                            className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors"
                          >
                            <p className="text-sm font-bold text-slate-900 truncate">
                              {s.placePrediction?.mainText?.text || s.placePrediction?.text?.text}
                            </p>
                            {s.placePrediction?.secondaryText?.text && (
                              <p className="text-xs text-slate-400 truncate">
                                {s.placePrediction.secondaryText.text}
                              </p>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">
                  City
                </label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900"
                    placeholder="Filled from Hotel Name"
                    required
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">
                Address
              </label>
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900"
                  placeholder="Filled from Hotel Name"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">
                  Country
                </label>
                <div className="relative">
                  <Globe2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    name="country"
                    value={formData.country}
                    onChange={handleInputChange}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900"
                    placeholder="Filled from City"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">
                  State / Province
                </label>
                <div className="relative">
                  <Map className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900"
                    placeholder="Filled from City"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">
                  Category
                  {googleRating != null && (
                    <span
                      className="normal-case font-bold text-amber-500 tracking-normal"
                      title="Google's guest review score — not an official star classification. Set the star category yourself."
                    >
                      Google: {googleRating.toFixed(1)}★ (guest rating)
                    </span>
                  )}
                </label>
                <div className="flex items-center gap-1 bg-slate-50 rounded-2xl px-4 py-3.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          category: prev.category === String(n) ? "" : String(n),
                        }))
                      }
                      className="p-0.5"
                      title={`${n} Star`}
                    >
                      <Star
                        className={`w-5 h-5 transition-colors ${
                          Number(formData.category) >= n
                            ? "fill-[#e7f63c] text-[#181c22]"
                            : "fill-transparent text-slate-300"
                        }`}
                        strokeWidth={1.5}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">
                  Availability
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      is_available: !prev.is_available,
                    }))
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
                  Total Rooms
                </label>
                <div className="relative">
                  <BedDouble className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="number"
                    min="0"
                    name="total_rooms"
                    value={formData.total_rooms}
                    onChange={handleInputChange}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900"
                    placeholder="e.g. 40"
                  />
                </div>
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
                    placeholder="hotel@example.com"
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
                    onChange={(phone) =>
                      setFormData((prev) => ({ ...prev, phone }))
                    }
                    inputClassName="!w-full !pr-4 !py-3.5 !bg-slate-50 !border-none !rounded-xl !text-sm !font-bold !text-slate-900 !focus:ring-2 !focus:ring-[#e7f63c]/20 !transition-all !placeholder:text-slate-300 !placeholder:font-medium"
                    containerClassName="!border-none"
                    buttonClassName="!bg-transparent !border-none !rounded-l-xl !pl-4 !mr-[-48px] !z-10"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 w-full">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1 px-1">
                  Room & Meal Pricing
                </label>
                <button
                  type="button"
                  onClick={() => addSection()}
                  className="flex items-center gap-2 text-sm text-blue-600"
                >
                  <Plus className="w-4 h-4" /> Add Price Row
                </button>
              </div>

              {priceSections.map((sec, idx) => (
                <div
                  key={sec.id}
                  className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end w-full p-4 md:p-0 bg-slate-50/50 md:bg-transparent rounded-xl md:rounded-none relative border border-slate-100 md:border-none pt-10 md:pt-0"
                >
                  <div className="md:col-span-2">
                    <label className="block text-[8px] font-black uppercase tracking-widest text-slate-600 mb-1 px-1">
                      {sec.room_type === "other"
                        ? "Custom Room Type"
                        : "Room Type"}
                    </label>
                    {sec.room_type === "other" ? (
                      <input
                        type="text"
                        value={sec.room_type_custom || ""}
                        onChange={(e) =>
                          updateSection(idx, "room_type_custom", e.target.value)
                        }
                        className="w-full pl-3 pr-2 py-2 bg-slate-50 md:bg-slate-50 border-none rounded-lg text-xs font-bold text-slate-900 shadow-sm md:shadow-none"
                        placeholder="e.g. Villa"
                        required
                      />
                    ) : (
                      <select
                        value={sec.room_type}
                        onChange={(e) =>
                          updateSection(idx, "room_type", e.target.value)
                        }
                        className="w-full pl-3 pr-2 py-2 bg-white md:bg-slate-50 border-none rounded-lg text-xs font-bold text-slate-900 shadow-sm md:shadow-none"
                      >
                        <option value="deluxe">Deluxe</option>
                        <option value="super_deluxe">Super Deluxe</option>
                        <option value="suite">Suite</option>
                        <option value="other">Other</option>
                      </select>
                    )}
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-[8px] font-black uppercase tracking-widest text-slate-600 mb-1 px-1">
                      Meal Plan
                    </label>
                    <select
                      value={sec.meal_plan}
                      onChange={(e) =>
                        updateSection(idx, "meal_plan", e.target.value)
                      }
                      className="w-full pl-3 pr-2 py-2 bg-white md:bg-slate-50 border-none rounded-lg text-xs font-bold text-slate-900 shadow-sm md:shadow-none"
                    >
                      <option value="room_only">Room only</option>
                      <option value="breakfast_only">Breakfast only</option>
                      <option value="breakfast_dinner">
                        Breakfast & Dinner
                      </option>
                      <option value="all_meals">
                        Breakfast, Lunch & Dinner
                      </option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[8px] font-black uppercase tracking-widest text-slate-600 mb-1 px-1">
                      Price
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                        ₹
                      </span>
                      <input
                        type="number"
                        value={sec.price}
                        onChange={(e) =>
                          updateSection(idx, "price", e.target.value)
                        }
                        className="w-full pl-6 pr-2 py-2 bg-white md:bg-slate-50 border-none rounded-lg text-xs font-bold text-slate-900 shadow-sm md:shadow-none"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[8px] font-black uppercase tracking-widest text-slate-600 mb-1 px-1">
                      CNB
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                        ₹
                      </span>
                      <input
                        type="number"
                        value={sec.cnb}
                        onChange={(e) =>
                          updateSection(idx, "cnb", e.target.value)
                        }
                        className="w-full pl-6 pr-2 py-2 bg-white md:bg-slate-50 border-none rounded-lg text-xs font-bold text-slate-900 shadow-sm md:shadow-none"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-1">
                    <label className="block text-[8px] font-black uppercase tracking-widest text-slate-600 mb-1 px-1">
                      5-12 Yrs
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                        ₹
                      </span>
                      <input
                        type="number"
                        value={sec.upto_5}
                        onChange={(e) =>
                          updateSection(idx, "upto_5", e.target.value)
                        }
                        className="w-full pl-6 pr-2 py-2 bg-white md:bg-slate-50 border-none rounded-lg text-xs font-bold text-slate-900 shadow-sm md:shadow-none"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-1">
                    <label className="block text-[8px] font-black uppercase tracking-widest text-slate-600 mb-1 px-1">
                      12+ Yrs
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                        ₹
                      </span>
                      <input
                        type="number"
                        value={sec.above_12}
                        onChange={(e) =>
                          updateSection(idx, "above_12", e.target.value)
                        }
                        className="w-full pl-6 pr-2 py-2 bg-white md:bg-slate-50 border-none rounded-lg text-xs font-bold text-slate-900 shadow-sm md:shadow-none"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-1 flex gap-2 absolute md:static top-3 right-3 md:top-auto md:right-auto">
                    <button
                      type="button"
                      onClick={() => removeSection(idx)}
                      title="Remove"
                      className="p-1.5 bg-red-50 hover:bg-red-100 md:bg-slate-50 md:hover:bg-slate-100 rounded-lg transition-colors group shadow-sm md:shadow-none"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500 md:text-slate-400 md:group-hover:text-red-500" />
                    </button>
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-[8px] font-black uppercase tracking-widest text-slate-600 mb-1 px-1">
                      Extra Adult
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                        ₹
                      </span>
                      <input
                        type="number"
                        value={sec.extra_adult}
                        onChange={(e) =>
                          updateSection(idx, "extra_adult", e.target.value)
                        }
                        className="w-full pl-6 pr-2 py-2 bg-white md:bg-slate-50 border-none rounded-lg text-xs font-bold text-slate-900 shadow-sm md:shadow-none"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-4">
                    <label className="block text-[8px] font-black uppercase tracking-widest text-slate-600 mb-1 px-1">
                      Season From (optional)
                    </label>
                    <input
                      type="date"
                      value={sec.valid_from || ""}
                      onChange={(e) =>
                        updateSection(idx, "valid_from", e.target.value)
                      }
                      className="w-full px-3 py-2 bg-white md:bg-slate-50 border-none rounded-lg text-xs font-bold text-slate-900 shadow-sm md:shadow-none"
                    />
                  </div>

                  <div className="md:col-span-4">
                    <label className="block text-[8px] font-black uppercase tracking-widest text-slate-600 mb-1 px-1">
                      Season To (optional)
                    </label>
                    <input
                      type="date"
                      value={sec.valid_to || ""}
                      onChange={(e) =>
                        updateSection(idx, "valid_to", e.target.value)
                      }
                      className="w-full px-3 py-2 bg-white md:bg-slate-50 border-none rounded-lg text-xs font-bold text-slate-900 shadow-sm md:shadow-none"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 w-full bg-slate-50/50 rounded-2xl p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600">
                  Market Reference Prices
                </label>
              </div>
              <p className="text-[10px] text-slate-400 font-medium -mt-2">
                Check the live price on each OTA below, then note what you saw here — this is a
                manual reference, not live scraping (no public API exists for this).
              </p>

              <div className="flex flex-wrap gap-2">
                {[
                  { label: "MakeMyTrip", domain: "makemytrip.com" },
                  { label: "EaseMyTrip", domain: "easemytrip.com" },
                  { label: "Goibibo", domain: "goibibo.com" },
                  { label: "Google Search", domain: null },
                ].map((ota) => {
                  const query = `${formData.name} ${formData.city} hotel`.trim();
                  const url = ota.domain
                    ? `https://www.google.com/search?q=${encodeURIComponent(`${query} site:${ota.domain}`)}`
                    : `https://www.google.com/search?q=${encodeURIComponent(`${query} price`)}`;
                  return (
                    <a
                      key={ota.label}
                      href={formData.name ? url : undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        if (!formData.name) {
                          e.preventDefault();
                          toast.error("Enter a hotel name first");
                        }
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 bg-white rounded-lg text-[10px] font-bold text-slate-700 hover:text-blue-600 ${
                        !formData.name ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      <ExternalLink className="w-3 h-3" /> Check {ota.label}
                    </a>
                  );
                })}
              </div>

              {marketPrices.length > 0 && (
                <div className="space-y-1.5">
                  {marketPrices.map((m, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-3 py-2 bg-white rounded-lg text-xs"
                    >
                      <span className="font-bold text-slate-900">{m.source}</span>
                      <span className="text-slate-500">{m.date}</span>
                      <span className="font-bold text-slate-900">
                        ₹{Number(m.price).toLocaleString("en-IN")}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeMarketPrice(i)}
                        className="text-slate-300 hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {marketAverage != null && (
                <div className="flex items-center justify-between px-3 py-2.5 bg-[#181c22] rounded-lg">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#e7f63c]" />
                    Suggested price: ₹{marketAverage.toLocaleString("en-IN")} (avg of{" "}
                    {marketPrices.length})
                  </span>
                  <button
                    type="button"
                    onClick={applySuggestedPrice}
                    className="text-[10px] font-black uppercase tracking-wider bg-[#e7f63c] text-[#181c22] px-2.5 py-1.5 rounded-md hover:bg-[#d4e42e]"
                  >
                    Use this price
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input
                  type="text"
                  value={marketPriceDraft.source}
                  onChange={(e) =>
                    setMarketPriceDraft((prev) => ({ ...prev, source: e.target.value }))
                  }
                  placeholder="Source (e.g. MakeMyTrip)"
                  className="sm:col-span-2 px-3 py-2 bg-white border-none rounded-lg text-xs font-bold text-slate-900"
                />
                <input
                  type="number"
                  value={marketPriceDraft.price}
                  onChange={(e) =>
                    setMarketPriceDraft((prev) => ({ ...prev, price: e.target.value }))
                  }
                  placeholder="Price seen"
                  className="px-3 py-2 bg-white border-none rounded-lg text-xs font-bold text-slate-900"
                />
                <button
                  type="button"
                  onClick={addMarketPrice}
                  className="flex items-center justify-center gap-1.5 text-xs font-bold text-blue-600 bg-white rounded-lg py-2"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            </div>

            <div className="space-y-3 w-full bg-slate-50/50 rounded-2xl p-4">
              <div className="flex items-center gap-2">
                <Wallet className="w-3.5 h-3.5 text-slate-500" />
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600">
                  Supplier Payment Terms
                </label>
              </div>

              <div>
                <label className="block text-[8px] font-black uppercase tracking-widest text-slate-500 mb-1">
                  Reference Event
                </label>
                <select
                  value={paymentTerms.reference_event}
                  onChange={(e) =>
                    setPaymentTerms((prev) => ({ ...prev, reference_event: e.target.value }))
                  }
                  className="w-full sm:w-64 px-3 py-2 bg-white border-none rounded-lg text-xs font-bold text-slate-900 appearance-none"
                >
                  <option value="booking_date">Booking Date</option>
                  <option value="service_date">Service (Check-in) Date</option>
                  <option value="month_end">Month End</option>
                </select>
              </div>

              {paymentTerms.installments.map((inst, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                  <input
                    type="text"
                    value={inst.label}
                    onChange={(e) => updateInstallment(i, "label", e.target.value)}
                    placeholder="e.g. Advance"
                    className="sm:col-span-2 px-3 py-2 bg-white border-none rounded-lg text-xs font-bold text-slate-900"
                  />
                  <div className="relative">
                    <input
                      type="number"
                      value={inst.percentage}
                      onChange={(e) => updateInstallment(i, "percentage", e.target.value)}
                      placeholder="%"
                      className="w-full pr-6 px-3 py-2 bg-white border-none rounded-lg text-xs font-bold text-slate-900"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                      %
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={inst.days_offset}
                      onChange={(e) => updateInstallment(i, "days_offset", e.target.value)}
                      placeholder="Days before"
                      className="w-full px-3 py-2 bg-white border-none rounded-lg text-xs font-bold text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => removeInstallment(i)}
                      className="text-slate-300 hover:text-red-500 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addInstallment}
                className="flex items-center gap-1.5 text-xs font-bold text-blue-600"
              >
                <Plus className="w-3.5 h-3.5" /> Add Installment
              </button>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">
                Photo Reference
              </label>
              <div className="relative w-full h-32 md:h-20 rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1 overflow-hidden">
                {formData.photo ? (
                  <img
                    src={formData.photo}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <>
                    <ImageIcon className="w-5 h-5 text-slate-300" />
                    <span className="text-[10px] font-bold text-slate-400 text-center px-4">
                      Upload Hotel Photo
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
                {submitting ? "Saving..." : "Save Accommodation"}
              </button>
              <button
                type="button"
                onClick={() => navigate("/accommodation")}
                className="w-full sm:w-auto text-slate-600 font-bold py-3.5"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AccommodationForm;
