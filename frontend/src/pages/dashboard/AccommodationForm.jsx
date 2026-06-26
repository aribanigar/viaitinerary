import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import { PhoneInput } from "react-international-phone";
import "react-international-phone/style.css";

const AccommodationForm = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    city: "",
    email: "",
    phone: "",
    photo: null,
  });

  const [priceSections, setPriceSections] = useState([]);

  const roomTypeOptions = ["deluxe", "super_deluxe", "suite"];

  useEffect(() => {
    if (isEditing && token) {
      (async () => {
        try {
          setLoading(true);
          const resp = await getHotel(id, token);

          setFormData({
            name: resp.name || "",
            city: resp.city || "",
            email: resp.email || "",
            phone: resp.phone || "",
            photo: resp.image_url || null,
          });

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
        field === "above_12"
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
            };
      return [...prev, newSec];
    });
  };

  const removeSection = (index) => {
    setPriceSections((prev) => prev.filter((_, i) => i !== index));
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
      }));

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
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">
                  Hotel Name
                </label>
                <div className="relative">
                  <Hotel className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900"
                    placeholder="e.g. Radisson Blu"
                    required
                  />
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
                    placeholder="City Name"
                    required
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
                    value={formData.phone}
                    onChange={(phone) =>
                      setFormData((prev) => ({ ...prev, phone }))
                    }
                    inputClassName="!w-full !pr-4 !py-3.5 !bg-slate-50 !border-none !rounded-xl !text-sm !font-bold !text-slate-900 !focus:ring-2 !focus:ring-blue-500/20 !transition-all !placeholder:text-slate-300 !placeholder:font-medium"
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
                </div>
              ))}
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
                className="w-full sm:w-auto bg-[#2563EB] text-white px-8 py-3.5 rounded-xl font-bold shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all"
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
