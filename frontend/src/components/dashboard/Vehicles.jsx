import React, { useState, useEffect } from "react";
import DashboardLayout from "./DashboardLayout";
import Modal from "../common/Modal";
import { PhoneInput } from "react-international-phone";
import "react-international-phone/style.css";
import {
  Plus,
  Car,
  Trash2,
  Pencil,
  Search,
  IndianRupee,
  Loader2,
  Mail,
  Phone,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  fetchVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
} from "../../api/vehicles";
import { toast } from "react-toastify";
import CompactDataTable from "../common/CompactDataTable";

const Vehicles = () => {
  const { token } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [vehicles, setVehicles] = useState([]);
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

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    price: "",
  });

  const loadVehicles = async (page = 1) => {
    try {
      setLoading(true);
      const resp = await fetchVehicles(token, {
        page,
        per_page: pageSize,
        search: searchQuery,
      });
      setVehicles(resp.data);
      setPagination({
        currentPage: resp.current_page,
        lastPage: resp.last_page,
        total: resp.total,
        from: resp.from,
        to: resp.to,
        perPage: resp.per_page,
      });
    } catch (error) {
      toast.error(error.message || "Failed to load vehicles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadVehicles(1);
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

  const handleEdit = (vehicle) => {
    setEditingId(vehicle.id);
    setFormData({
      name: vehicle.name,
      email: vehicle.email || "",
      phone: vehicle.phone || "",
      price: vehicle.price,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this vehicle?")) {
      try {
        await deleteVehicle(id, token);
        toast.success("Vehicle deleted successfully");
        loadVehicles(pagination.currentPage);
      } catch (error) {
        toast.error(error.message || "Failed to delete vehicle");
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (editingId) {
        await updateVehicle(editingId, formData, token);
        toast.success("Vehicle updated successfully");
      } else {
        await createVehicle(formData, token);
        toast.success("Vehicle created successfully");
      }
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({ name: "", price: "" });
      loadVehicles(1);
    } catch (error) {
      toast.error(error.message || "Failed to save vehicle");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 leading-tight">
              Transportation
            </h1>
            <p className="text-slate-400 font-medium mt-1">
              Manage your fleet and pricing.
            </p>
          </div>
          <button
            onClick={() => {
              setEditingId(null);
              setFormData({ name: "", price: "" });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-[#c7f135] text-[#10182a] px-6 py-3 rounded-2xl font-bold shadow-lg shadow-[#c7f135]/40 hover:bg-[#b0dc00] transition-all text-sm w-fit"
          >
            <Plus className="w-4 h-4" />
            Add New Car
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search cars..."
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#c7f135]/20 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <CompactDataTable
          headers={[
            { label: "Car Details" },
            { label: "Contact Info" },
            { label: "Created By" },
            { label: "Price (INR)" },
            { label: "Actions", className: "text-right" },
          ]}
          loading={loading}
          loadingText="Loading cars..."
          hasRows={vehicles.length > 0}
          emptyIcon={<Car className="w-8 h-8" />}
          emptyTitle="No cars found"
          emptyDescription={
            searchQuery
              ? "Try a different search term."
              : "Start by adding your first vehicle."
          }
          pagination={pagination}
          onPageChange={loadVehicles}
          onPageSizeChange={handlePageSizeChange}
        >
          {vehicles.map((vehicle) => (
            <tr key={vehicle.id} className="hover:bg-slate-50/50 group">
              <td>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                    <Car className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 capitalize text-sm">
                      {vehicle.name}
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <div className="flex flex-col gap-1">
                  {vehicle.email ? (
                    <a
                      href={`mailto:${vehicle.email}`}
                      className="flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors w-fit group/link"
                    >
                      <Mail className="w-3.5 h-3.5 text-blue-500 group-hover/link:animate-pulse" />
                      <span className="text-xs font-bold truncate max-w-[150px]">
                        {vehicle.email}
                      </span>
                    </a>
                  ) : (
                    <span className="text-[10px] text-slate-300 italic">
                      No email
                    </span>
                  )}
                  {vehicle.phone ? (
                    <a
                      href={`https://wa.me/${vehicle.phone.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-slate-600 hover:text-emerald-600 transition-colors w-fit group/link"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-500 group-hover/link:animate-pulse" />
                      <span className="text-xs font-bold">{vehicle.phone}</span>
                    </a>
                  ) : (
                    <span className="text-[10px] text-slate-300 italic">
                      No phone
                    </span>
                  )}
                </div>
              </td>
              <td>
                <div className="flex flex-col">
                  <span className="font-bold text-slate-900 text-xs">
                    {vehicle.creator_name || "Admin"}
                  </span>
                  <span className="text-slate-400 text-[10px] font-medium">
                    {vehicle.creator_email}
                  </span>
                </div>
              </td>
              <td>
                <div className="font-bold text-emerald-600">
                  ₹{parseFloat(vehicle.price).toLocaleString()}
                </div>
              </td>
              <td className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleEdit(vehicle)}
                    className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(vehicle.id)}
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
        title="Car"
        isEditing={!!editingId}
        onSubmit={handleSubmit}
        submitButtonText="Add Car"
        submitting={submitting}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
              Car Name
            </label>
            <div className="relative">
              <Car className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-[#c7f135]/20 transition-all placeholder:text-slate-300"
                placeholder="e.g. Toyota Innova, Swift Dzire"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
              Email Address
            </label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-[#c7f135]/20 transition-all placeholder:text-slate-300"
                placeholder="driver@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2 px-1">
              Phone Number
            </label>
            <div className="relative phone-input-container">
              <PhoneInput
                defaultCountry="in"
                value={formData.phone}
                onChange={(phone) => setFormData({ ...formData, phone })}
                inputClassName="!w-full !pr-4 !py-3 !bg-slate-50 !border-none !rounded-2xl !text-sm !font-bold !text-slate-900 !focus:ring-2 !focus:ring-[#c7f135]/20 !transition-all !placeholder:text-slate-300 !placeholder:font-medium !h-[44px]"
                containerClassName="!border-none"
                buttonClassName="!bg-transparent !border-none !rounded-l-2xl !pl-4 !mr-[-48px] !z-10"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
              Price (INR)
            </label>
            <div className="relative">
              <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                name="price"
                type="number"
                value={formData.price}
                onChange={handleInputChange}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-[#c7f135]/20 transition-all placeholder:text-slate-300"
                placeholder="0.00"
                required
                min="0"
                step="0.01"
              />
            </div>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
};

export default Vehicles;
