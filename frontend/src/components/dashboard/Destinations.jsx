import React, { useState, useEffect } from "react";
import DashboardLayout from "./DashboardLayout";
import Modal from "../common/Modal";
import {
  Plus,
  Upload,
  MapPin,
  Trash2,
  Pencil,
  Search,
  ImageIcon,
  Loader2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  fetchDestinations,
  fetchDestination,
  createDestination,
  updateDestination,
  deleteDestination,
} from "../../api/destinations";
import { toast } from "react-toastify";
import PageHeader from "../common/PageHeader";
import CompactDataTable from "../common/CompactDataTable";

const Destinations = () => {
  const { token } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    lastPage: 1,
    total: 0,
    from: 0,
    to: 0,
    perPage: 25,
  });
  const [editingLoading, setEditingLoading] = useState(new Set());

  const [formData, setFormData] = useState({
    name: "",
    activities: "",
    photo: null,
  });

  const loadDestinations = async (page = 1) => {
    try {
      setLoading(true);
      const resp = await fetchDestinations(token, {
        page,
        per_page: pageSize,
        search: searchQuery,
      });
      setDestinations(resp.data);
      setPagination({
        currentPage: resp.current_page,
        lastPage: resp.last_page,
        total: resp.total,
        from: resp.from,
        to: resp.to,
        perPage: resp.per_page,
      });
    } catch (error) {
      toast.error(error.message || "Failed to load destinations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadDestinations(1);
  }, [token, searchQuery, pageSize]);

  const handlePageSizeChange = (value) => {
    setPageSize(value);
    setPagination((prev) => ({ ...prev, perPage: value }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({
          ...prev,
          photo: reader.result,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEdit = async (destination) => {
    try {
      setEditingLoading((prev) => new Set(prev).add(destination.id));
      const fullDest = await fetchDestination(destination.id, token);
      setEditingId(fullDest.id);
      setFormData({
        name: fullDest.name,
        activities: (fullDest.activities || []).join("\n"),
        photo: fullDest.image_path,
      });
      setIsModalOpen(true);
    } catch (error) {
      toast.error("Error fetching destination details");
    } finally {
      setEditingLoading((prev) => {
        const newSet = new Set(prev);
        newSet.delete(destination.id);
        return newSet;
      });
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this destination?")) {
      try {
        await deleteDestination(id, token);
        toast.success("Destination deleted successfully");
        loadDestinations(pagination.currentPage);
      } catch (error) {
        toast.error("Failed to delete destination");
      }
    }
  };

  const handleSubmit = async (e) => {
    try {
      setSubmitting(true);
      const dataToSend = {
        name: formData.name,
        activities: formData.activities
          .split("\n")
          .filter((line) => line.trim() !== ""),
        photo:
          formData.photo && formData.photo.startsWith("data:")
            ? formData.photo
            : undefined,
      };

      if (editingId) {
        await updateDestination(editingId, dataToSend, token);
        toast.success("Destination updated successfully");
      } else {
        await createDestination(dataToSend, token);
        toast.success("Destination added successfully");
      }

      setFormData({ name: "", activities: "", photo: null });
      setEditingId(null);
      setIsModalOpen(false);
      loadDestinations(1);
    } catch (error) {
      toast.error(
        editingId
          ? "Failed to update destination"
          : "Failed to add destination",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const formatImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith("http") || path.startsWith("data:")) return path;
    const apiBase = (
      import.meta.env.VITE_API_URL || "http://localhost:8000/api"
    ).replace(/\/$/, "");
    return `${apiBase}/storage/${path}`;
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Destinations"
        description="Manage and explore travel destinations for your trips."
      >
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({ name: "", activities: "", photo: null });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-[#2563EB] text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-600 transition-all text-sm w-fit"
        >
          <Plus className="w-4 h-4" />
          Add New Destination
        </button>
      </PageHeader>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name..."
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-300 placeholder:font-medium"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <CompactDataTable
          headers={[
            { label: "Destination" },
            { label: "Created By" },
            { label: "Activities" },
            { label: "Actions", className: "text-right" },
          ]}
          loading={loading}
          loadingText="Loading destinations..."
          hasRows={destinations.length > 0}
          emptyIcon={<MapPin className="w-8 h-8" />}
          emptyTitle="No destinations found"
          emptyDescription={
            searchQuery
              ? "Try a different search term."
              : "Start by adding your first travel destination."
          }
          pagination={pagination}
          onPageChange={loadDestinations}
          onPageSizeChange={handlePageSizeChange}
        >
          {destinations.map((destination) => (
            <tr
              key={destination.id}
              className="hover:bg-slate-50/50 group transition-colors"
            >
              <td>
                <div>
                  <div className="font-bold text-slate-900 capitalize text-sm">
                    {destination.name}
                  </div>
                  <div className="text-slate-400 text-[10px] mt-1 font-medium">
                    {(destination.activities || []).length} Total Activities
                  </div>
                </div>
              </td>
              <td>
                <div className="flex flex-col">
                  <span className="font-bold text-slate-900 text-[11px]">
                    {destination.creator_name || "Admin"}
                  </span>
                  <span className="text-slate-400 text-[10px] font-medium">
                    {destination.creator_email}
                  </span>
                </div>
              </td>
              <td>
                <div className="flex flex-wrap gap-1.5">
                  {(destination.activities || [])
                    .slice(0, 2)
                    .map((activity, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-bold rounded-md uppercase tracking-wider"
                      >
                        {activity}
                      </span>
                    ))}
                  {(destination.activities || []).length > 2 && (
                    <span className="text-[9px] font-black text-blue-500 uppercase tracking-wider">
                      + {(destination.activities || []).length - 2} MORE
                    </span>
                  )}
                </div>
              </td>
              <td className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => handleEdit(destination)}
                    disabled={editingLoading.has(destination.id)}
                    className="p-1.5 hover:bg-blue-50 text-slate-300 hover:text-blue-600 rounded-lg transition-all disabled:opacity-50"
                  >
                    {editingLoading.has(destination.id) ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Pencil className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(destination.id)}
                    className="p-1.5 hover:bg-red-50 text-slate-300 hover:text-red-600 rounded-lg transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </CompactDataTable>
      </div>

      {/* Add Destination Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingId(null);
        }}
        title="Destination"
        isEditing={!!editingId}
        onSubmit={handleSubmit}
        submitButtonText="Save Destination"
        submitting={submitting}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">
              Destination Name
            </label>
            <div className="relative group">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-300 placeholder:font-medium"
                placeholder="e.g. Kashmir, Delhi, Shimla"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">
              Activities
            </label>
            <div className="bg-slate-50 rounded-2xl p-4 min-h-[120px] focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:bg-white transition-all">
              <textarea
                name="activities"
                value={formData.activities}
                onChange={handleInputChange}
                placeholder="Add activities here... (one activity per line)"
                className="w-full bg-transparent border-none focus:ring-0 focus:outline-none text-sm font-bold text-slate-900 placeholder:text-slate-300 resize-none min-h-[100px] custom-scrollbar"
                required
              />
            </div>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-2 ml-1">
              Tip: Enter each activity on a new line
            </p>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">
              Photo Reference
            </label>
            <div className="relative group">
              <div className="w-full h-32 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1 hover:border-blue-400 transition-colors cursor-pointer relative overflow-hidden">
                {formData.photo ? (
                  <>
                    <img
                      src={formatImageUrl(formData.photo)}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Upload className="w-5 h-5 text-white" />
                    </div>
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-6 h-6 text-slate-300" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      Upload Reference Image
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
            </div>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-2 ml-1">
              Accepted formats: JPG, JPEG, PNG, WebP
            </p>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
};

export default Destinations;
