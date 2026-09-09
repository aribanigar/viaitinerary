import React, { useState, useEffect, useRef } from "react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";
import {
  fetchDestination,
  createDestination,
  updateDestination,
  searchDestinationPhotos,
} from "../../api/destinations";
import {
  MapPin,
  ListChecks,
  ImageIcon,
  Search,
  Loader2,
  CheckCircle2,
  ImageOff,
} from "lucide-react";

const SEARCH_DEBOUNCE_MS = 500;

// Activities are stored as [{ name, cost }] (cost 0 = free/bundled), but the
// editor stays a plain textarea — one activity per line, optionally
// "Name | Cost" — so old plain-string data and new costed entries both work.
const activitiesToText = (activities) =>
  (activities || [])
    .map((a) => {
      if (typeof a === "string") return a;
      const cost = Number(a?.cost) || 0;
      return cost > 0 ? `${a.name} | ${cost}` : a?.name || "";
    })
    .filter(Boolean)
    .join("\n");

const textToActivities = (text) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, costStr] = line.split("|").map((part) => part.trim());
      const cost = costStr ? Number(costStr) || 0 : 0;
      return { name: name || line, cost };
    });

const DestinationForm = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    activities: "",
    photo: null,
  });

  const [photoQuery, setPhotoQuery] = useState("");
  const [photoResults, setPhotoResults] = useState([]);
  const [photoSearching, setPhotoSearching] = useState(false);
  const [photoSearched, setPhotoSearched] = useState(false);
  const searchDebounceRef = useRef(null);

  useEffect(() => {
    if (isEditing && token) {
      (async () => {
        try {
          setLoading(true);
          const resp = await fetchDestination(id, token);
          setFormData({
            name: resp.name || "",
            activities: activitiesToText(resp.activities),
            photo: resp.image_url || null,
          });
        } catch (error) {
          toast.error("Error fetching destination details");
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [isEditing, id, token]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const runPhotoSearch = async (query) => {
    if (!query.trim()) {
      setPhotoResults([]);
      setPhotoSearched(false);
      return;
    }
    try {
      setPhotoSearching(true);
      const resp = await searchDestinationPhotos(query.trim(), token);
      setPhotoResults(resp.data || []);
    } catch (error) {
      toast.error(error.message || "Photo search failed");
      setPhotoResults([]);
    } finally {
      setPhotoSearching(false);
      setPhotoSearched(true);
    }
  };

  const handlePhotoQueryChange = (e) => {
    const value = e.target.value;
    setPhotoQuery(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => runPhotoSearch(value), SEARCH_DEBOUNCE_MS);
  };

  const handlePhotoSearchKeyDown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    runPhotoSearch(photoQuery);
  };

  useEffect(() => {
    // Seed the photo search with the destination name once it's known, so an
    // editor lands on relevant results without having to type anything.
    if (formData.name && !photoQuery && !photoSearched) {
      setPhotoQuery(formData.name);
      runPhotoSearch(formData.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.name]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Destination name is required");
      return;
    }

    try {
      setSubmitting(true);
      const dataToSend = {
        name: formData.name,
        activities: textToActivities(formData.activities),
        photo: formData.photo || undefined,
      };

      if (isEditing) {
        await updateDestination(id, dataToSend, token);
        toast.success("Destination updated successfully");
      } else {
        await createDestination(dataToSend, token);
        toast.success("Destination added successfully");
      }

      navigate("/destinations");
    } catch (error) {
      toast.error(
        isEditing ? "Failed to update destination" : "Failed to add destination",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <h2 className="font-bold text-lg">{isEditing ? "Edit" : "Add"} Destination</h2>
        <div>
          <button
            onClick={() => navigate("/destinations")}
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
              <MapPin className="w-4 h-4 text-[#181c22]" />
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">
                Destination Details
              </h3>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">
                Destination Name
              </label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  autoComplete="off"
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900"
                  placeholder="e.g. Paris, Tokyo, Bali"
                  required
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">
                <ListChecks className="w-3.5 h-3.5" /> Activities
              </label>
              <div className="bg-slate-50 rounded-2xl p-4 min-h-[120px] focus-within:ring-2 focus-within:ring-[#e7f63c]/20 focus-within:bg-white transition-all">
                <textarea
                  name="activities"
                  value={formData.activities}
                  onChange={handleInputChange}
                  placeholder="Add activities here... (one per line, e.g. Shikara Ride | 800)"
                  className="w-full bg-transparent border-none focus:ring-0 focus:outline-none text-sm font-bold text-slate-900 placeholder:text-slate-300 resize-none min-h-[100px]"
                />
              </div>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-2 ml-1">
                Tip: One activity per line. Add "| cost" for a per-person price
                (e.g. Gondola Ride | 1200) — leave it off for a free/bundled
                activity.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#181c22]" />
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">
                  Photo
                </h3>
              </div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                Powered by Pixabay
              </span>
            </div>

            {formData.photo && (
              <div className="relative w-full h-40 rounded-2xl bg-slate-100 overflow-hidden">
                <img
                  src={formData.photo}
                  alt="Selected"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 right-2 flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#181c22]/80 text-white text-[10px] font-bold">
                  <CheckCircle2 className="w-3 h-3" /> Selected
                </div>
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={photoQuery}
                onChange={handlePhotoQueryChange}
                onKeyDown={handlePhotoSearchKeyDown}
                autoComplete="off"
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 placeholder:text-slate-300 placeholder:font-medium"
                placeholder="Search Pixabay for a photo… (e.g. Santorini beach)"
              />
              {photoSearching && (
                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
              )}
            </div>

            {photoResults.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {photoResults.map((photo) => {
                  const selected = formData.photo === photo.full;
                  return (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, photo: photo.full }))
                      }
                      title={photo.tags}
                      className={`relative aspect-square rounded-xl overflow-hidden bg-slate-100 transition-all ${
                        selected
                          ? "ring-2 ring-[#e7f63c] ring-offset-2"
                          : "hover:opacity-80"
                      }`}
                    >
                      <img
                        src={photo.thumb}
                        alt={photo.tags || "Pixabay photo"}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {selected && (
                        <div className="absolute inset-0 bg-[#181c22]/30 flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5 text-[#e7f63c]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              !photoSearching &&
              photoSearched && (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-slate-300">
                  <ImageOff className="w-6 h-6" />
                  <span className="text-xs font-bold">No photos found — try another search</span>
                </div>
              )
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto bg-[#e7f63c] text-[#181c22] px-8 py-3.5 rounded-xl font-bold shadow-lg shadow-[#e7f63c]/40 active:scale-[0.98] transition-all"
            >
              {submitting ? "Saving..." : "Save Destination"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/destinations")}
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

export default DestinationForm;
