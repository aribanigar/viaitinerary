import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "./DashboardLayout";
import ConfirmationModal from "../common/ConfirmationModal";
import PageHeader from "../common/PageHeader";
import {
  Plus,
  Car,
  Trash2,
  Pencil,
  Search,
  Mail,
  MessageCircle,
  SlidersHorizontal,
  X,
  MapPin,
  CheckCircle2,
  XCircle,
  Compass,
  Eye,
  Users,
} from "lucide-react";
import { fetchVehicles, deleteVehicle } from "../../api/vehicles";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";
import CompactDataTable from "../common/CompactDataTable";
import VehicleDetailsPanel from "./VehicleDetailsPanel";

// Client-side pagination/filtering: an agency's vehicle catalog is small
// enough (tens to low hundreds) to fetch once and filter instantly, rather
// than round-tripping to the server on every filter change.
const FETCH_ALL_PAGE_SIZE = 1000;

const vehicleTypeLabel = (type) => (type ? type.replace(/_/g, " ") : "Vehicle");

const SPLIT_TRANSITION = { duration: 0.4, ease: [0.22, 1, 0.36, 1] };
const PANEL_WIDTH = 440;

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}

const EMPTY_FILTERS = {
  vehicleType: "",
  ac: "",
  fuelType: "",
  availability: "",
  priceMin: "",
  priceMax: "",
};

const Vehicles = () => {
  const { token } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [targetId, setTargetId] = useState(null);
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const isDesktop = useIsDesktop();

  const navigate = useNavigate();

  const openVehiclePanel = (vehicle) => {
    setSelectedVehicle(vehicle);
    setPanelOpen(true);
  };

  useEffect(() => {
    if (token) loadVehicles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadVehicles = async () => {
    try {
      setLoading(true);
      const resp = await fetchVehicles(token, { per_page: FETCH_ALL_PAGE_SIZE });
      setVehicles(resp.data);
    } catch (error) {
      toast.error(error.message || "Error fetching vehicles");
    } finally {
      setLoading(false);
    }
  };

  const vehicleTypeOptions = useMemo(
    () => [...new Set(vehicles.map((v) => v.vehicle_type).filter(Boolean))].sort(),
    [vehicles],
  );
  const fuelTypeOptions = useMemo(
    () => [...new Set(vehicles.map((v) => v.fuel_type).filter(Boolean))].sort(),
    [vehicles],
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (q && !`${v.name} ${v.city || ""}`.toLowerCase().includes(q)) return false;
      if (filters.vehicleType && v.vehicle_type !== filters.vehicleType) return false;
      if (filters.ac === "ac" && !v.is_ac) return false;
      if (filters.ac === "non_ac" && v.is_ac !== false) return false;
      if (filters.fuelType && v.fuel_type !== filters.fuelType) return false;
      if (filters.availability === "available" && !v.is_available) return false;
      if (filters.availability === "unavailable" && v.is_available) return false;
      const price = Number(v.price);
      if (filters.priceMin && (Number.isNaN(price) || price < Number(filters.priceMin)))
        return false;
      if (filters.priceMax && (Number.isNaN(price) || price > Number(filters.priceMax)))
        return false;
      return true;
    });
  }, [vehicles, searchQuery, filters]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filters, pageSize]);

  const lastPage = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(currentPage, lastPage);
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);
  const pagination = {
    currentPage: page,
    lastPage,
    total: filtered.length,
    from: filtered.length ? (page - 1) * pageSize + 1 : 0,
    to: Math.min(page * pageSize, filtered.length),
    perPage: pageSize,
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const availableCount = vehicles.filter((v) => v.is_available).length;
  const avgPrice = useMemo(() => {
    const prices = vehicles.map((v) => Number(v.price)).filter((n) => !Number.isNaN(n) && n > 0);
    if (!prices.length) return null;
    return Math.round(prices.reduce((sum, n) => sum + n, 0) / prices.length);
  }, [vehicles]);

  const stats = [
    {
      label: "Total Vehicles",
      value: vehicles.length.toString(),
      change: "In your fleet",
      icon: Car,
      bgColor: "bg-[#e7f63c]",
      iconColor: "text-[#181c22]",
      onClick: () => setFilters(EMPTY_FILTERS),
    },
    {
      label: "Available Now",
      value: availableCount.toString(),
      change: "Ready to book",
      icon: CheckCircle2,
      bgColor: "bg-[#181c22]",
      iconColor: "text-white",
      onClick: () => setFilters({ ...EMPTY_FILTERS, availability: "available" }),
    },
    {
      label: "Unavailable",
      value: (vehicles.length - availableCount).toString(),
      change: "Currently on hold",
      icon: XCircle,
      bgColor: "bg-[#181c22]",
      iconColor: "text-white",
      onClick: () => setFilters({ ...EMPTY_FILTERS, availability: "unavailable" }),
    },
    {
      label: "Vehicle Types",
      value: vehicleTypeOptions.length.toString(),
      change: avgPrice != null ? `Avg. from ₹${avgPrice.toLocaleString("en-IN")}` : "Add pricing to see averages",
      icon: Compass,
      bgColor: "bg-[#181c22]",
      iconColor: "text-white",
      onClick: null,
    },
  ];

  const handleDeleteClick = (id) => {
    setTargetId(id);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      await deleteVehicle(targetId, token);
      setVehicles((prev) => prev.filter((v) => v.id !== targetId));
      toast.success("Vehicle deleted successfully");
      setDeleteModalOpen(false);
    } catch (error) {
      toast.error(error.message || "Error deleting vehicle");
    } finally {
      setIsDeleting(false);
      setTargetId(null);
    }
  };

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  return (
    <DashboardLayout>
      <PageHeader
        title="Transportation"
        description="Manage your fleet, drivers, and pricing."
        compact={panelOpen}
      >
        <button
          onClick={() => navigate("/transportation/add")}
          className={`flex items-center gap-2 bg-[#e7f63c] text-[#181c22] rounded-2xl font-bold shadow-lg shadow-[#e7f63c]/40 hover:bg-[#d4e42e] transition-all text-sm w-fit ${
            panelOpen ? "px-4 py-2" : "px-6 py-3"
          }`}
        >
          <Plus className="w-4 h-4" />
          Add New Vehicle
        </button>
      </PageHeader>

      {!loading && (
        <div
          className={`flex flex-wrap items-center gap-2 transition-all duration-300 ${
            panelOpen ? "mb-4" : "mb-8"
          }`}
        >
          {stats.map((stat, i) => {
            const Tag = stat.onClick ? "button" : "div";
            return (
              <Tag
                key={i}
                onClick={stat.onClick || undefined}
                title={stat.change}
                className={`flex items-center gap-2 rounded-2xl border border-black/5 bg-white shadow-sm transition-all duration-300 ${
                  panelOpen ? "h-9 pl-1 pr-2.5" : "h-11 pl-1.5 pr-3.5"
                } ${stat.onClick ? "hover:shadow-md hover:-translate-y-0.5 cursor-pointer" : ""}`}
              >
                <span
                  className={`grid place-items-center rounded-xl shrink-0 transition-all duration-300 ${stat.bgColor} ${
                    panelOpen ? "w-6 h-6" : "w-8 h-8"
                  }`}
                >
                  <stat.icon className={`${panelOpen ? "w-3 h-3" : "w-4 h-4"} ${stat.iconColor}`} />
                </span>
                {!panelOpen && (
                  <span className="text-xs font-bold text-[#181c22] whitespace-nowrap">
                    {stat.label}
                  </span>
                )}
                <span
                  className={`grid place-items-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#f3f3f4] font-black text-[#181c22] ${
                    panelOpen ? "text-[10px]" : "text-[11px]"
                  }`}
                >
                  {stat.value}
                </span>
              </Tag>
            );
          })}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="min-w-0 w-full lg:flex-1 bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-black/5 flex flex-wrap gap-2 justify-between items-center bg-[#f3f3f4]/60">
            <h3 className="text-sm font-bold text-[#181c22] uppercase tracking-widest">
              All Vehicles
            </h3>
            <span className="text-[10px] font-bold text-[#8a93a2] uppercase tracking-widest">
              {filtered.length} of {vehicles.length}
            </span>
          </div>
          <div className="p-6 border-b border-black/5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name or city..."
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#e7f63c]/20 transition-all placeholder:text-slate-300 placeholder:font-medium font-medium"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button
                onClick={() => setFiltersOpen((v) => !v)}
                className={`relative flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-colors shrink-0 ${
                  filtersOpen || activeFilterCount
                    ? "bg-[#181c22] text-white"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="grid place-items-center w-5 h-5 rounded-full bg-[#e7f63c] text-[#181c22] text-[10px] font-black">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>

            {filtersOpen && (
              <div className="flex flex-wrap items-end gap-3 pt-1">
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                    Vehicle Type
                  </label>
                  <select
                    value={filters.vehicleType}
                    onChange={(e) => setFilter("vehicleType", e.target.value)}
                    className="bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-900 py-2.5 px-3 pr-8 appearance-none min-w-[140px] capitalize"
                  >
                    <option value="">All types</option>
                    {vehicleTypeOptions.map((t) => (
                      <option key={t} value={t} className="capitalize">
                        {vehicleTypeLabel(t)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                    AC / Non-AC
                  </label>
                  <select
                    value={filters.ac}
                    onChange={(e) => setFilter("ac", e.target.value)}
                    className="bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-900 py-2.5 px-3 pr-8 appearance-none min-w-[110px]"
                  >
                    <option value="">Any</option>
                    <option value="ac">AC</option>
                    <option value="non_ac">Non-AC</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                    Fuel Type
                  </label>
                  <select
                    value={filters.fuelType}
                    onChange={(e) => setFilter("fuelType", e.target.value)}
                    className="bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-900 py-2.5 px-3 pr-8 appearance-none min-w-[130px] capitalize"
                  >
                    <option value="">All fuel types</option>
                    {fuelTypeOptions.map((f) => (
                      <option key={f} value={f} className="capitalize">
                        {f.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                    Availability
                  </label>
                  <select
                    value={filters.availability}
                    onChange={(e) => setFilter("availability", e.target.value)}
                    className="bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-900 py-2.5 px-3 pr-8 appearance-none min-w-[130px]"
                  >
                    <option value="">All</option>
                    <option value="available">Available</option>
                    <option value="unavailable">Unavailable</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                    Price Range (₹)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      placeholder="Min"
                      value={filters.priceMin}
                      onChange={(e) => setFilter("priceMin", e.target.value)}
                      className="w-20 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-900 py-2.5 px-3"
                    />
                    <span className="text-slate-300 text-xs">–</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="Max"
                      value={filters.priceMax}
                      onChange={(e) => setFilter("priceMax", e.target.value)}
                      className="w-20 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-900 py-2.5 px-3"
                    />
                  </div>
                </div>

                {activeFilterCount > 0 && (
                  <button
                    onClick={() => setFilters(EMPTY_FILTERS)}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-red-500 transition-colors py-2.5"
                  >
                    <X className="w-3.5 h-3.5" /> Clear filters
                  </button>
                )}
              </div>
            )}
          </div>

          <CompactDataTable
            headers={[
              { label: "Vehicle" },
              { label: "Capacity" },
              { label: "Price" },
              { label: "Availability" },
              { label: "Contact" },
              { label: "Actions", className: "text-right" },
            ]}
            loading={loading}
            loadingText="Loading vehicles..."
            hasRows={pageItems.length > 0}
            emptyIcon={<Car className="w-8 h-8" />}
            emptyTitle="No vehicles found"
            emptyDescription={
              searchQuery || activeFilterCount
                ? "Try a different search term or clear your filters."
                : "Start by adding your first vehicle."
            }
            pagination={pagination}
            onPageChange={(p) => setCurrentPage(p)}
            onPageSizeChange={(size) => setPageSize(size)}
          >
            {pageItems.map((vehicle) => (
              <tr key={vehicle.id} className="hover:bg-slate-50/50 group transition-colors">
                <td>
                  <button
                    onClick={() => openVehiclePanel(vehicle)}
                    className="flex items-center gap-3 text-left w-full"
                  >
                    <div className="w-11 h-11 rounded-xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                      {vehicle.image_url ? (
                        <img
                          src={vehicle.image_url}
                          alt={vehicle.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Car className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 capitalize truncate hover:underline">
                        {vehicle.name}
                      </div>
                      <div className="text-slate-400 text-[11px] mt-0.5 flex items-center gap-1 truncate capitalize">
                        {vehicle.vehicle_type ? (
                          <>
                            {vehicleTypeLabel(vehicle.vehicle_type)}
                            {vehicle.is_ac != null && ` · ${vehicle.is_ac ? "AC" : "Non-AC"}`}
                          </>
                        ) : (
                          <>
                            <MapPin className="w-3 h-3 shrink-0" />
                            {[vehicle.city, vehicle.state].filter(Boolean).join(", ") || "—"}
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                </td>
                <td>
                  {vehicle.seating_capacity != null ? (
                    <span className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                      <Users className="w-3.5 h-3.5 text-slate-400" /> {vehicle.seating_capacity}
                    </span>
                  ) : (
                    <span className="text-slate-300 text-xs">—</span>
                  )}
                </td>
                <td>
                  <div>
                    <span className="font-bold text-slate-900 text-xs">
                      ₹{Number(vehicle.price || 0).toLocaleString("en-IN")}
                    </span>
                    {vehicle.rate_type && (
                      <span className="text-slate-400 text-[10px] ml-1 capitalize">
                        /{vehicle.rate_type.replace("per_", "")}
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  {vehicle.is_available ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                      <CheckCircle2 className="w-3 h-3" /> Available
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">
                      <XCircle className="w-3 h-3" /> Unavailable
                    </span>
                  )}
                </td>
                <td>
                  <div className="flex items-center gap-1.5">
                    {vehicle.email ? (
                      <a
                        href={`mailto:${vehicle.email}`}
                        title={vehicle.email}
                        className="grid place-items-center w-8 h-8 rounded-lg bg-blue-50 text-blue-500 hover:bg-blue-100 transition-colors"
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </a>
                    ) : null}
                    {vehicle.phone ? (
                      <a
                        href={`https://wa.me/${vehicle.phone.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={vehicle.phone}
                        className="grid place-items-center w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </a>
                    ) : null}
                    {!vehicle.email && !vehicle.phone && (
                      <span className="text-[10px] text-slate-300 italic">No contact</span>
                    )}
                  </div>
                </td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => openVehiclePanel(vehicle)}
                      className="p-2 hover:bg-slate-100 text-slate-300 hover:text-slate-700 rounded-xl transition-all"
                      title="View details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => navigate(`/transportation/edit/${vehicle.id}`)}
                      className="p-2 hover:bg-blue-50 text-slate-300 hover:text-blue-600 rounded-xl transition-all"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(vehicle.id)}
                      className="p-2 hover:bg-red-50 text-slate-300 hover:text-red-600 rounded-xl transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </CompactDataTable>
        </div>

        <AnimatePresence>
          {panelOpen && selectedVehicle && (
            <motion.div
              key="vehicle-panel"
              initial={isDesktop ? { width: 0, opacity: 0 } : { opacity: 0, y: 16 }}
              animate={isDesktop ? { width: PANEL_WIDTH, opacity: 1 } : { opacity: 1, y: 0 }}
              exit={isDesktop ? { width: 0, opacity: 0 } : { opacity: 0, y: 16 }}
              transition={SPLIT_TRANSITION}
              className="w-full lg:shrink-0 overflow-hidden lg:sticky lg:top-0"
            >
              <div className="w-full" style={isDesktop ? { width: PANEL_WIDTH } : undefined}>
                <VehicleDetailsPanel
                  vehicle={selectedVehicle}
                  onClose={() => setPanelOpen(false)}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Vehicle"
        message="Are you sure you want to delete this vehicle? This action cannot be undone."
        confirmText="Delete"
        loading={isDeleting}
      />
    </DashboardLayout>
  );
};

export default Vehicles;
