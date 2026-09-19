import React, { useState, useEffect } from "react";
import DashboardLayout from "./DashboardLayout";
import Modal from "../common/Modal";
import ConfirmationModal from "../common/ConfirmationModal";
import PageHeader from "../common/PageHeader";
import {
  Plus,
  Ticket,
  Trash2,
  Pencil,
  Search,
  IndianRupee,
  CheckCircle2,
  XCircle,
  MapPin,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  fetchActivities,
  createActivity,
  updateActivity,
  deleteActivity,
} from "../../api/activities";
import { fetchDestinations } from "../../api/destinations";
import { toast } from "react-toastify";
import CompactDataTable from "../common/CompactDataTable";

const EMPTY_FORM = {
  name: "",
  destination_id: "",
  cost: "",
  selling_price: "",
  duration_hours: "",
  description: "",
  is_active: true,
};

const Activities = () => {
  const { token } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activities, setActivities] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [destinationFilter, setDestinationFilter] = useState("");
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [targetId, setTargetId] = useState(null);

  const [formData, setFormData] = useState(EMPTY_FORM);

  const loadActivities = async (page = 1) => {
    try {
      setLoading(true);
      const resp = await fetchActivities(token, {
        page,
        per_page: pageSize,
        search: searchQuery,
        ...(destinationFilter ? { destination_id: destinationFilter } : {}),
      });
      setActivities(resp.data);
      setPagination({
        currentPage: resp.current_page,
        lastPage: resp.last_page,
        total: resp.total,
        from: resp.from,
        to: resp.to,
        perPage: resp.per_page,
      });
    } catch (error) {
      toast.error(error.message || "Failed to load activities");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadActivities(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, searchQuery, destinationFilter, pageSize]);

  useEffect(() => {
    if (!token) return;
    fetchDestinations(token, { per_page: 1000 })
      .then((resp) => setDestinations(resp.data || []))
      .catch(() => {});
  }, [token]);

  const handlePageSizeChange = (value) => {
    setPageSize(value);
    setPagination((prev) => ({ ...prev, perPage: value }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEdit = (activity) => {
    setEditingId(activity.id);
    setFormData({
      name: activity.name,
      destination_id: activity.destination_id != null ? String(activity.destination_id) : "",
      cost: activity.cost != null ? String(activity.cost) : "",
      selling_price: String(activity.selling_price ?? ""),
      duration_hours: activity.duration_hours != null ? String(activity.duration_hours) : "",
      description: activity.description || "",
      is_active: activity.is_active ?? true,
    });
    setIsModalOpen(true);
  };

  const handleDeleteClick = (id) => {
    setTargetId(id);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      await deleteActivity(targetId, token);
      toast.success("Activity deleted successfully");
      setDeleteModalOpen(false);
      loadActivities(pagination.currentPage);
    } catch (error) {
      toast.error(error.message || "Failed to delete activity");
    } finally {
      setIsDeleting(false);
      setTargetId(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (editingId) {
        await updateActivity(editingId, formData, token);
        toast.success("Activity updated successfully");
      } else {
        await createActivity(formData, token);
        toast.success("Activity created successfully");
      }
      setIsModalOpen(false);
      setEditingId(null);
      setFormData(EMPTY_FORM);
      loadActivities(1);
    } catch (error) {
      toast.error(error.message || "Failed to save activity");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Activities"
        description="Priced, ticketed activities agents can add to an itinerary — optionally tied to a destination."
      >
        <button
          onClick={() => {
            setEditingId(null);
            setFormData(EMPTY_FORM);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-[#e7f63c] text-[#181c22] px-6 py-3 rounded-2xl font-bold shadow-lg shadow-[#e7f63c]/40 hover:bg-[#d4e42e] transition-all text-sm w-fit"
        >
          <Plus className="w-4 h-4" />
          Add New Activity
        </button>
      </PageHeader>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search activities..."
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#e7f63c]/20 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            value={destinationFilter}
            onChange={(e) => setDestinationFilter(e.target.value)}
            className="px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#e7f63c]/20 transition-all"
          >
            <option value="">All destinations</option>
            {destinations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <CompactDataTable
          headers={[
            { label: "Activity" },
            { label: "Destination" },
            { label: "Cost" },
            { label: "Selling Price" },
            { label: "Status" },
            { label: "Actions", className: "text-right" },
          ]}
          loading={loading}
          loadingText="Loading activities..."
          hasRows={activities.length > 0}
          emptyIcon={<Ticket className="w-8 h-8" />}
          emptyTitle="No activities found"
          emptyDescription={
            searchQuery || destinationFilter
              ? "Try a different search or destination."
              : "Start by adding your first activity."
          }
          pagination={pagination}
          onPageChange={loadActivities}
          onPageSizeChange={handlePageSizeChange}
        >
          {activities.map((activity) => (
            <tr key={activity.id} className="hover:bg-slate-50/50 group">
              <td>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
                    <Ticket className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 text-sm truncate">
                      {activity.name}
                    </div>
                    {activity.description && (
                      <div className="text-slate-400 text-[11px] truncate max-w-xs">
                        {activity.description}
                      </div>
                    )}
                  </div>
                </div>
              </td>
              <td>
                {activity.destination_name ? (
                  <span className="inline-flex items-center gap-1 text-slate-500 text-xs font-bold">
                    <MapPin className="w-3.5 h-3.5" />
                    {activity.destination_name}
                  </span>
                ) : (
                  <span className="text-slate-300 text-xs font-bold">Any destination</span>
                )}
              </td>
              <td>
                <span className="text-slate-500 text-xs font-bold">
                  {activity.cost != null
                    ? `₹${Number(activity.cost).toLocaleString("en-IN")}`
                    : "—"}
                </span>
              </td>
              <td>
                <div className="font-bold text-emerald-600">
                  ₹{Number(activity.selling_price).toLocaleString("en-IN")}
                  <span className="text-slate-400 font-medium"> /ticket</span>
                </div>
              </td>
              <td>
                {activity.is_active ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                    <CheckCircle2 className="w-3 h-3" /> Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">
                    <XCircle className="w-3 h-3" /> Inactive
                  </span>
                )}
              </td>
              <td className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleEdit(activity)}
                    className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(activity.id)}
                    className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </CompactDataTable>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingId(null);
        }}
        title="Activity"
        isEditing={!!editingId}
        onSubmit={handleSubmit}
        submitButtonText="Add Activity"
        submitting={submitting}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
              Activity Name
            </label>
            <div className="relative">
              <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-[#e7f63c]/20 transition-all placeholder:text-slate-300"
                placeholder="e.g. Gondola Ride, River Rafting"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
              Destination
            </label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                name="destination_id"
                value={formData.destination_id}
                onChange={handleInputChange}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-medium appearance-none"
              >
                <option value="">Any destination</option>
                {destinations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                Supplier Cost (₹)
              </label>
              <div className="relative">
                <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  name="cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.cost}
                  onChange={handleInputChange}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-medium"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                Selling Price (₹ / ticket)
              </label>
              <div className="relative">
                <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  name="selling_price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.selling_price}
                  onChange={handleInputChange}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-medium"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
              Duration (hours)
            </label>
            <input
              name="duration_hours"
              type="number"
              min="0"
              step="0.5"
              value={formData.duration_hours}
              onChange={handleInputChange}
              className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-medium"
              placeholder="Optional, e.g. 2"
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
              Description / Conditions
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-medium resize-none"
              placeholder="Optional notes, e.g. weather-dependent, min age 8"
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
              Status
            </label>
            <button
              type="button"
              onClick={() =>
                setFormData((prev) => ({ ...prev, is_active: !prev.is_active }))
              }
              className={`w-full flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold transition-colors ${
                formData.is_active
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {formData.is_active ? "Active" : "Inactive"}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Activity"
        message="Are you sure you want to delete this activity? This action cannot be undone."
        confirmText="Delete"
        loading={isDeleting}
      />
    </DashboardLayout>
  );
};

export default Activities;
