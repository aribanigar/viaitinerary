import React, { useState, useEffect } from "react";
import DashboardLayout from "./DashboardLayout";
import Modal from "../common/Modal";
import { PhoneInput } from "react-international-phone";
import "react-international-phone/style.css";
import {
  Image as ImageIcon,
  MapPin,
  IndianRupee,
  Type,
  Plus,
  Trash2,
  Edit2,
  Loader2,
  Search,
  ExternalLink,
  Eye,
  EyeOff,
  Building2,
  Phone,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  fetchShowcaseItems,
  createShowcaseItem,
  updateShowcaseItem,
  deleteShowcaseItem,
} from "../../api/showcase";
import { toast } from "react-toastify";
import CompactDataTable from "../common/CompactDataTable";

const SuperAdminShowcase = () => {
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingLoading, setEditingLoading] = useState(new Set());
  const [tablePage, setTablePage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [formData, setFormData] = useState({
    city: "",
    title: "",
    agency_name: "",
    whatsapp_number: "",
    price: "",
    image: null,
    is_active: true,
    sort_order: 0,
  });

  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    if (token) loadItems();
  }, [token]);

  const loadItems = async () => {
    try {
      setLoading(true);
      const data = await fetchShowcaseItems();
      setItems(data);
    } catch (err) {
      toast.error("Failed to load showcase items");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, image: reader.result }));
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormData({
      city: "",
      title: "",
      agency_name: "",
      whatsapp_number: "",
      price: "",
      image: null,
      is_active: true,
      sort_order: items.length,
    });
    setImagePreview(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingId(item.id);
    setFormData({
      city: item.city,
      title: item.title,
      agency_name: item.agency_name || "",
      whatsapp_number: item.whatsapp_number || "",
      price: item.price,
      image: item.image,
      is_active: item.is_active,
      sort_order: item.sort_order,
    });
    setImagePreview(item.image_url);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    if (!formData.whatsapp_number || formData.whatsapp_number.length < 5) {
      toast.error("WhatsApp Number is required");
      return;
    }

    try {
      setSubmitting(true);
      if (editingId) {
        await updateShowcaseItem(token, editingId, formData);
        toast.success("Item updated successfully");
      } else {
        await createShowcaseItem(token, formData);
        toast.success("Item created successfully");
      }
      setIsModalOpen(false);
      loadItems();
    } catch (err) {
      toast.error(err.message || "Failed to save item");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this item?")) return;
    try {
      await deleteShowcaseItem(token, id);
      toast.success("Item deleted successfully");
      loadItems();
    } catch (err) {
      toast.error("Failed to delete item");
    }
  };

  const filteredItems = items.filter(
    (item) =>
      item.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const lastPage = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(tablePage, lastPage);
  const from =
    filteredItems.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, filteredItems.length);
  const paginatedItems = filteredItems.slice(from ? from - 1 : 0, to);

  useEffect(() => {
    setTablePage(1);
  }, [searchQuery, pageSize]);

  const handlePageSizeChange = (value) => {
    setPageSize(value);
    setTablePage(1);
  };

  return (
    <DashboardLayout>
      <div className="mb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 leading-tight">
              Landing Page Showcase
            </h1>
            <p className="text-slate-400 font-medium mt-1">
              Manage the itinerary showcase on the landing page
            </p>
          </div>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-[#c7f135] text-[#10182a] px-6 py-3 rounded-xl font-bold shadow-lg shadow-[#c7f135]/40 hover:bg-[#b0dc00] transition-all text-sm w-fit"
          >
            <Plus className="w-4 h-4" />
            Add Showcase Item
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by city or title..."
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#c7f135]/20 transition-all placeholder:text-slate-300 placeholder:font-medium font-medium"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <CompactDataTable
          headers={[
            { label: "Item Details" },
            { label: "Title" },
            { label: "Price", className: "text-center" },
            { label: "Status", className: "text-center" },
            { label: "Actions", className: "text-right" },
          ]}
          loading={loading}
          loadingText="Loading showcase items..."
          hasRows={paginatedItems.length > 0}
          emptyIcon={<ImageIcon className="w-8 h-8" />}
          emptyTitle="No items found"
          emptyDescription={
            searchQuery
              ? "Try a different search term or add a new showcase item."
              : "Start by adding your first showcase item."
          }
          pagination={{
            currentPage,
            lastPage,
            total: filteredItems.length,
            from,
            to,
            perPage: pageSize,
          }}
          onPageChange={setTablePage}
          onPageSizeChange={handlePageSizeChange}
        >
          {paginatedItems.map((item) => (
            <tr
              key={item.id}
              className="hover:bg-slate-50/50 group transition-colors"
            >
              <td>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 overflow-hidden">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.city}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 capitalize">
                      {item.city}
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <div className="text-slate-600 font-medium line-clamp-1">
                  {item.title}
                </div>
              </td>
              <td className="text-center">
                <div className="inline-flex items-center gap-1 font-bold text-blue-600">
                  <IndianRupee className="w-3 h-3" />
                  {item.price}
                </div>
              </td>
              <td className="text-center">
                {item.is_active ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-600 text-[10px] font-black rounded-lg uppercase tracking-wider">
                    <Eye className="w-3 h-3" />
                    Visible
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-400 text-[10px] font-black rounded-lg uppercase tracking-wider">
                    <EyeOff className="w-3 h-3" />
                    Hidden
                  </span>
                )}
              </td>
              <td className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => openEditModal(item)}
                    disabled={editingLoading.has(item.id)}
                    className="p-2 hover:bg-blue-50 text-slate-300 hover:text-blue-600 rounded-xl transition-all disabled:opacity-50"
                  >
                    {editingLoading.has(item.id) ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Edit2 className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 hover:bg-red-50 text-slate-300 hover:text-red-600 rounded-xl transition-all"
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
        title="Showcase Item"
        isEditing={!!editingId}
        onSubmit={handleSubmit}
        submitButtonText="Save Showcase Item"
        submitting={submitting}
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">
                City Name
              </label>
              <div className="relative group">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  placeholder="e.g. Bali, Indonesia"
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#c7f135]/20 transition-all placeholder:text-slate-300 placeholder:font-medium"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">
                Starting Price
              </label>
              <div className="relative group">
                <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                  name="price"
                  type="number"
                  value={formData.price}
                  onChange={handleInputChange}
                  placeholder="25000"
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#c7f135]/20 transition-all placeholder:text-slate-300 placeholder:font-medium"
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">
                Agency Name (Optional)
              </label>
              <div className="relative group">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                  name="agency_name"
                  value={formData.agency_name}
                  onChange={handleInputChange}
                  placeholder="e.g. Ace Travels"
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#c7f135]/20 transition-all placeholder:text-slate-300 placeholder:font-medium"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1 text-slate-400">
                WhatsApp Number <span className="text-red-500">*</span>
              </label>
              <div className="phone-input-container">
                <PhoneInput
                  defaultCountry="in"
                  value={formData.whatsapp_number}
                  onChange={(phone) =>
                    setFormData({ ...formData, whatsapp_number: phone })
                  }
                  className="w-full"
                  inputClassName="!w-full !px-4 !py-7 !bg-slate-50 !border-none !rounded-xl !text-sm !font-bold !text-slate-900 !focus:ring-2 !focus:ring-[#c7f135]/20 !transition-all !placeholder:text-slate-300 !placeholder:font-medium"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">
              Itinerary Title
            </label>
            <div className="relative group">
              <Type className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="e.g. 7 Days • Honeymoon Special"
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#c7f135]/20 transition-all placeholder:text-slate-300 placeholder:font-medium"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">
              Cover Image
            </label>
            <div className="relative group">
              <div className="w-full h-48 rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1 hover:border-blue-400 transition-colors cursor-pointer relative overflow-hidden">
                {imagePreview ? (
                  <>
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Plus className="w-5 h-5 text-white" />
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
                  onChange={handleImageChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  accept=".jpg,.jpeg,.png,.webp"
                  required={!editingId && !imagePreview}
                />
              </div>
            </div>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-2 ml-1">
              Accepted formats: JPG, JPEG, PNG, WebP
            </p>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div>
              <div className="text-sm font-bold text-slate-900">
                Display Status
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                Toggle visibility on landing page
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleInputChange}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#c7f135]"></div>
            </label>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
};

export default SuperAdminShowcase;
