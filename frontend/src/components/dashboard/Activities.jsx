import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  Plus,
  Ticket,
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
  Map as MapIcon,
  Eye,
} from "lucide-react";
import DashboardLayout from "./DashboardLayout";
import ConfirmationModal from "../common/ConfirmationModal";
import PageHeader from "../common/PageHeader";
import CompactDataTable from "../common/CompactDataTable";
import ActivityDetailsPanel from "./ActivityDetailsPanel";
import { useAuth } from "../../context/AuthContext";
import { fetchActivities, deleteActivity } from "../../api/activities";

// The Activities catalog, laid out exactly like Accommodation: stat buttons,
// search + filters, a lean table, and a details panel that opens beside it.
// Fetched once and filtered client-side (an agency's catalog is hundreds,
// not tens of thousands).
const FETCH_ALL_PAGE_SIZE = 1000;

const CATEGORY_LABEL = {
  sightseeing: "Sightseeing",
  adventure: "Adventure",
  cultural: "Cultural",
  water: "Water",
  snow: "Snow",
  experience: "Experience",
  transfer: "Transfer / Ride",
  other: "Other",
};

const MotionDiv = motion.div;
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

/** The lowest adult selling price across the base rate and every option. */
const startingPrice = (a) => {
  const prices = [a.selling_price, ...(a.price_sections || []).map((s) => s.price)]
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  return prices.length ? Math.min(...prices) : null;
};
const placeOf = (a) => [a.city || a.destination_name, a.state, a.country].filter(Boolean).join(", ");

const EMPTY_FILTERS = { destination: "", category: "", state: "", availability: "", priceMin: "", priceMax: "" };

const selectCls =
  "bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-900 py-2.5 px-3 pr-8 appearance-none min-w-[140px]";
const FilterField = ({ label, children }) => (
  <div>
    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">{label}</label>
    {children}
  </div>
);

const Activities = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [targetId, setTargetId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        setLoading(true);
        const resp = await fetchActivities(token, { per_page: FETCH_ALL_PAGE_SIZE });
        setActivities(resp.data || []);
      } catch (error) {
        toast.error(error.message || "Error fetching activities");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const destinationOptions = useMemo(
    () => [...new Set(activities.map((a) => a.destination_name).filter(Boolean))].sort(),
    [activities],
  );
  const stateOptions = useMemo(() => [...new Set(activities.map((a) => a.state).filter(Boolean))].sort(), [activities]);
  const categoryOptions = useMemo(
    () => [...new Set(activities.map((a) => a.category).filter(Boolean))].sort(),
    [activities],
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activities.filter((a) => {
      if (q && !`${a.name} ${a.city || ""} ${a.destination_name || ""} ${a.supplier_name || ""}`.toLowerCase().includes(q)) return false;
      if (filters.destination && a.destination_name !== filters.destination) return false;
      if (filters.category && a.category !== filters.category) return false;
      if (filters.state && a.state !== filters.state) return false;
      if (filters.availability === "available" && !a.is_active) return false;
      if (filters.availability === "unavailable" && a.is_active) return false;
      const price = startingPrice(a);
      if (filters.priceMin && (price == null || price < Number(filters.priceMin))) return false;
      if (filters.priceMax && (price == null || price > Number(filters.priceMax))) return false;
      return true;
    });
  }, [activities, searchQuery, filters]);

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
  const availableCount = activities.filter((a) => a.is_active).length;
  const avgPrice = useMemo(() => {
    const prices = activities.map(startingPrice).filter((n) => n != null);
    return prices.length ? Math.round(prices.reduce((s, n) => s + n, 0) / prices.length) : null;
  }, [activities]);

  const stats = [
    { label: "Total Activities", value: activities.length, change: "In your catalog", icon: Ticket, bgColor: "bg-accent", iconColor: "text-ink", onClick: () => setFilters(EMPTY_FILTERS) },
    { label: "Available Now", value: availableCount, change: "Ready to book", icon: CheckCircle2, bgColor: "bg-brand", iconColor: "text-white", onClick: () => setFilters({ ...EMPTY_FILTERS, availability: "available" }) },
    { label: "Unavailable", value: activities.length - availableCount, change: "Currently on hold", icon: XCircle, bgColor: "bg-brand", iconColor: "text-white", onClick: () => setFilters({ ...EMPTY_FILTERS, availability: "unavailable" }) },
    {
      label: "Destinations Covered",
      value: destinationOptions.length,
      change: avgPrice != null ? `Avg. from ₹${avgPrice.toLocaleString("en-IN")}` : "Add pricing to see averages",
      icon: MapIcon,
      bgColor: "bg-brand",
      iconColor: "text-white",
      onClick: null,
    },
  ];

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));
  const openPanel = (a) => {
    setSelected(a);
    setPanelOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      await deleteActivity(targetId, token);
      setActivities((prev) => prev.filter((a) => a.id !== targetId));
      if (selected?.id === targetId) setPanelOpen(false);
      toast.success("Activity deleted");
      setDeleteModalOpen(false);
    } catch (error) {
      toast.error(error.message || "Error deleting activity");
    } finally {
      setIsDeleting(false);
      setTargetId(null);
    }
  };

  return (
    <DashboardLayout>
      <PageHeader title="Activities" description="Manage your activities, experiences and their rates." compact={panelOpen}>
        <button
          onClick={() => navigate("/activities/add")}
          className={`flex items-center gap-2 bg-accent text-ink rounded-2xl font-bold shadow-lg shadow-accent/40 hover:bg-accent-hover transition-all text-sm w-fit ${
            panelOpen ? "px-4 py-2" : "px-6 py-3"
          }`}
        >
          <Plus className="w-4 h-4" />
          Add New Activity
        </button>
      </PageHeader>

      {!loading && (
        <div className={`flex flex-wrap items-center gap-2 transition-all duration-300 ${panelOpen ? "mb-4" : "mb-8"}`}>
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
                <span className={`grid place-items-center rounded-xl shrink-0 transition-all duration-300 ${stat.bgColor} ${panelOpen ? "w-6 h-6" : "w-8 h-8"}`}>
                  {React.createElement(stat.icon, { className: `${panelOpen ? "w-3 h-3" : "w-4 h-4"} ${stat.iconColor}` })}
                </span>
                {!panelOpen && <span className="text-xs font-bold text-ink whitespace-nowrap">{stat.label}</span>}
                <span className={`grid place-items-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#f3f3f4] font-black text-ink ${panelOpen ? "text-[10px]" : "text-[11px]"}`}>
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
            <h3 className="text-sm font-bold text-ink uppercase tracking-widest">All Activities</h3>
            <span className="text-[10px] font-bold text-[#8a93a2] uppercase tracking-widest">
              {filtered.length} of {activities.length}
            </span>
          </div>
          <div className="p-6 border-b border-black/5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name, city or supplier..."
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-accent/20 transition-all placeholder:text-slate-300 placeholder:font-medium"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button
                onClick={() => setFiltersOpen((v) => !v)}
                className={`relative flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-colors shrink-0 ${
                  filtersOpen || activeFilterCount ? "bg-brand text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="grid place-items-center w-5 h-5 rounded-full bg-accent text-ink text-[10px] font-black">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>

            {filtersOpen && (
              <div className="flex flex-wrap items-end gap-3 pt-1">
                <FilterField label="Destination">
                  <select value={filters.destination} onChange={(e) => setFilter("destination", e.target.value)} className={selectCls}>
                    <option value="">All destinations</option>
                    {destinationOptions.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </FilterField>
                <FilterField label="Category">
                  <select value={filters.category} onChange={(e) => setFilter("category", e.target.value)} className={selectCls}>
                    <option value="">All categories</option>
                    {categoryOptions.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABEL[c] || c}
                      </option>
                    ))}
                  </select>
                </FilterField>
                <FilterField label="State">
                  <select value={filters.state} onChange={(e) => setFilter("state", e.target.value)} className={selectCls}>
                    <option value="">All states</option>
                    {stateOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </FilterField>
                <FilterField label="Availability">
                  <select value={filters.availability} onChange={(e) => setFilter("availability", e.target.value)} className={`${selectCls} min-w-[130px]`}>
                    <option value="">All</option>
                    <option value="available">Available</option>
                    <option value="unavailable">Unavailable</option>
                  </select>
                </FilterField>
                <FilterField label="Price Range (₹)">
                  <div className="flex items-center gap-1.5">
                    <input type="number" min="0" placeholder="Min" value={filters.priceMin} onChange={(e) => setFilter("priceMin", e.target.value)} className="w-20 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-900 py-2.5 px-3" />
                    <span className="text-slate-300 text-xs">–</span>
                    <input type="number" min="0" placeholder="Max" value={filters.priceMax} onChange={(e) => setFilter("priceMax", e.target.value)} className="w-20 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-900 py-2.5 px-3" />
                  </div>
                </FilterField>
                {activeFilterCount > 0 && (
                  <button onClick={() => setFilters(EMPTY_FILTERS)} className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-red-500 transition-colors py-2.5">
                    <X className="w-3.5 h-3.5" /> Clear filters
                  </button>
                )}
              </div>
            )}
          </div>

          <CompactDataTable
            headers={[
              { label: "Activity" },
              { label: "Category" },
              { label: "Starting Price" },
              { label: "Availability" },
              { label: "Contact" },
              { label: "Actions", className: "text-right" },
            ]}
            loading={loading}
            loadingText="Loading activities..."
            hasRows={pageItems.length > 0}
            emptyIcon={<Ticket className="w-8 h-8" />}
            emptyTitle="No activities found"
            emptyDescription={searchQuery || activeFilterCount ? "Try a different search term or clear your filters." : "Start by adding your first activity or experience."}
            pagination={pagination}
            onPageChange={(p) => setCurrentPage(p)}
            onPageSizeChange={(size) => setPageSize(size)}
          >
            {pageItems.map((a) => {
              const price = startingPrice(a);
              const options = (a.price_sections || []).length;
              return (
                <tr key={a.id} className="hover:bg-slate-50/50 group transition-colors">
                  <td>
                    <button onClick={() => openPanel(a)} className="flex items-center gap-3 text-left w-full">
                      <div className="w-11 h-11 rounded-xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                        {a.image_url ? <img src={a.image_url} alt={a.name} className="w-full h-full object-cover" /> : <Ticket className="w-4 h-4 text-slate-300" />}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate hover:underline">{a.name}</div>
                        <div className="text-slate-400 text-[11px] mt-0.5 flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 shrink-0" />
                          {placeOf(a) || "—"}
                        </div>
                      </div>
                    </button>
                  </td>
                  <td>
                    {a.category ? (
                      <span className="px-2.5 py-1 rounded-full bg-[#f3f3f4] text-ink text-[10px] font-bold">{CATEGORY_LABEL[a.category] || a.category}</span>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                  <td>
                    {price != null ? (
                      <div>
                        <span className="font-bold text-slate-900 text-xs">₹{price.toLocaleString("en-IN")}</span>
                        <span className="text-slate-400 text-[10px] ml-1">/ person</span>
                        {options > 0 && <span className="text-slate-400 text-[10px] ml-1">+{options} rate{options === 1 ? "" : "s"}</span>}
                      </div>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                  <td>
                    {a.is_active ? (
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
                      {a.email ? (
                        <a href={`mailto:${a.email}`} title={a.email} className="grid place-items-center w-8 h-8 rounded-lg bg-blue-50 text-blue-500 hover:bg-blue-100 transition-colors">
                          <Mail className="w-3.5 h-3.5" />
                        </a>
                      ) : null}
                      {a.phone ? (
                        <a
                          href={`https://wa.me/${a.phone.replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={a.phone}
                          className="grid place-items-center w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                      ) : null}
                      {!a.email && !a.phone && <span className="text-[10px] text-slate-300 italic">No contact</span>}
                    </div>
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openPanel(a)} className="p-2 hover:bg-slate-100 text-slate-300 hover:text-slate-700 rounded-xl transition-all" title="View details">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => navigate(`/activities/edit/${a.id}`)} className="p-2 hover:bg-blue-50 text-slate-300 hover:text-blue-600 rounded-xl transition-all" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setTargetId(a.id);
                          setDeleteModalOpen(true);
                        }}
                        className="p-2 hover:bg-red-50 text-slate-300 hover:text-red-600 rounded-xl transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </CompactDataTable>
        </div>

        <AnimatePresence>
          {panelOpen && selected && (
            <MotionDiv
              key="activity-panel"
              initial={isDesktop ? { width: 0, opacity: 0 } : { opacity: 0, y: 16 }}
              animate={isDesktop ? { width: PANEL_WIDTH, opacity: 1 } : { opacity: 1, y: 0 }}
              exit={isDesktop ? { width: 0, opacity: 0 } : { opacity: 0, y: 16 }}
              transition={SPLIT_TRANSITION}
              className="w-full lg:shrink-0 overflow-hidden lg:sticky lg:top-0"
            >
              <div className="w-full" style={isDesktop ? { width: PANEL_WIDTH } : undefined}>
                <ActivityDetailsPanel activity={selected} onClose={() => setPanelOpen(false)} />
              </div>
            </MotionDiv>
          )}
        </AnimatePresence>
      </div>

      <ConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Activity"
        message="Are you sure you want to delete this activity? Trips that use it keep their own copy."
        confirmText="Delete"
        loading={isDeleting}
      />
    </DashboardLayout>
  );
};

export default Activities;
