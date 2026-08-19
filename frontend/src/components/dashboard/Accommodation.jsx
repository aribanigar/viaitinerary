import React, { useState, useEffect, useMemo } from "react";
import DashboardLayout from "./DashboardLayout";
import ConfirmationModal from "../common/ConfirmationModal";
import PageHeader from "../common/PageHeader";
import {
  Plus,
  Hotel,
  Trash2,
  Pencil,
  Search,
  Mail,
  MessageCircle,
  Star,
  SlidersHorizontal,
  X,
  MapPin,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { getHotels, deleteHotel } from "../../api/hotels";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";
import CompactDataTable from "../common/CompactDataTable";

// Client-side pagination/filtering: an agency's hotel catalog is small
// enough (tens to low hundreds) to fetch once and filter instantly, rather
// than round-tripping to the server on every filter change.
const FETCH_ALL_PAGE_SIZE = 1000;

const startingPrice = (hotel) => {
  const prices = (hotel.price_sections || [])
    .map((s) => Number(s.price))
    .filter((n) => !Number.isNaN(n) && n > 0);
  return prices.length ? Math.min(...prices) : null;
};

const StarRow = ({ count }) => {
  const n = parseInt(count, 10) || 0;
  if (!n) return <span className="text-slate-300 text-xs">—</span>;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: n }, (_, i) => (
        <Star key={i} className="w-3.5 h-3.5 fill-[#e7f63c] text-[#181c22]" strokeWidth={1.5} />
      ))}
    </div>
  );
};

const EMPTY_FILTERS = {
  state: "",
  city: "",
  minStars: "",
  availability: "",
  priceMin: "",
  priceMax: "",
};

const Accommodation = () => {
  const { token } = useAuth();
  const [accommodations, setAccommodations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [targetId, setTargetId] = useState(null);
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  const navigate = useNavigate();

  useEffect(() => {
    if (token) fetchHotels();
  }, [token]);

  const fetchHotels = async () => {
    try {
      setLoading(true);
      const resp = await getHotels(token, { per_page: FETCH_ALL_PAGE_SIZE });
      setAccommodations(resp.data);
    } catch (error) {
      toast.error(error.message || "Error fetching hotels");
    } finally {
      setLoading(false);
    }
  };

  const stateOptions = useMemo(
    () =>
      [...new Set(accommodations.map((a) => a.state).filter(Boolean))].sort(),
    [accommodations],
  );
  const cityOptions = useMemo(
    () =>
      [
        ...new Set(
          accommodations
            .filter((a) => !filters.state || a.state === filters.state)
            .map((a) => a.city)
            .filter(Boolean),
        ),
      ].sort(),
    [accommodations, filters.state],
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return accommodations.filter((a) => {
      if (q && !`${a.name} ${a.city || ""}`.toLowerCase().includes(q))
        return false;
      if (filters.state && a.state !== filters.state) return false;
      if (filters.city && a.city !== filters.city) return false;
      if (filters.minStars && (parseInt(a.category, 10) || 0) < parseInt(filters.minStars, 10))
        return false;
      if (filters.availability === "available" && !a.is_available) return false;
      if (filters.availability === "unavailable" && a.is_available) return false;
      const price = startingPrice(a);
      if (filters.priceMin && (price == null || price < Number(filters.priceMin)))
        return false;
      if (filters.priceMax && (price == null || price > Number(filters.priceMax)))
        return false;
      return true;
    });
  }, [accommodations, searchQuery, filters]);

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

  const handleDeleteClick = (id) => {
    setTargetId(id);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      await deleteHotel(targetId, token);
      setAccommodations((prev) => prev.filter((a) => a.id !== targetId));
      toast.success("Accommodation deleted successfully");
      setDeleteModalOpen(false);
    } catch (error) {
      toast.error(error.message || "Error deleting hotel");
    } finally {
      setIsDeleting(false);
      setTargetId(null);
    }
  };

  const setFilter = (key, value) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  return (
    <DashboardLayout>
      <PageHeader
        title="Accommodation"
        description="Manage your hotel partners and stay options."
      >
        <button
          onClick={() => navigate("/accommodation/add")}
          className="flex items-center gap-2 bg-[#e7f63c] text-[#181c22] px-6 py-3 rounded-2xl font-bold shadow-lg shadow-[#e7f63c]/40 hover:bg-[#d4e42e] transition-all text-sm w-fit"
        >
          <Plus className="w-4 h-4" />
          Add New Accommodation
        </button>
      </PageHeader>

      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
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
                  State
                </label>
                <select
                  value={filters.state}
                  onChange={(e) => {
                    setFilter("state", e.target.value);
                    setFilter("city", "");
                  }}
                  className="bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-900 py-2.5 px-3 pr-8 appearance-none min-w-[140px]"
                >
                  <option value="">All states</option>
                  {stateOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                  City
                </label>
                <select
                  value={filters.city}
                  onChange={(e) => setFilter("city", e.target.value)}
                  className="bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-900 py-2.5 px-3 pr-8 appearance-none min-w-[140px]"
                >
                  <option value="">All cities</option>
                  {cityOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                  Category
                </label>
                <select
                  value={filters.minStars}
                  onChange={(e) => setFilter("minStars", e.target.value)}
                  className="bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-900 py-2.5 px-3 pr-8 appearance-none min-w-[110px]"
                >
                  <option value="">Any rating</option>
                  {[3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}★ &amp; up
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
            { label: "Hotel" },
            { label: "Category" },
            { label: "Starting Price" },
            { label: "Availability" },
            { label: "Contact" },
            { label: "Actions", className: "text-right" },
          ]}
          loading={loading}
          loadingText="Loading stays..."
          hasRows={pageItems.length > 0}
          emptyIcon={<Hotel className="w-8 h-8" />}
          emptyTitle="No accommodations found"
          emptyDescription={
            searchQuery || activeFilterCount
              ? "Try a different search term or clear your filters."
              : "Start by adding your first hotel or stay option."
          }
          pagination={pagination}
          onPageChange={(p) => setCurrentPage(p)}
          onPageSizeChange={(size) => setPageSize(size)}
        >
          {pageItems.map((accommodation) => {
            const price = startingPrice(accommodation);
            const planCount = (accommodation.price_sections || []).length;
            return (
              <tr
                key={accommodation.id}
                className="hover:bg-slate-50/50 group transition-colors"
              >
                <td>
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                      {accommodation.image_url ? (
                        <img
                          src={accommodation.image_url}
                          alt={accommodation.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Hotel className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 capitalize truncate">
                        {accommodation.name}
                      </div>
                      <div className="text-slate-400 text-[11px] mt-0.5 flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {[accommodation.city, accommodation.state]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <StarRow count={accommodation.category} />
                </td>
                <td>
                  {price != null ? (
                    <div>
                      <span className="font-bold text-slate-900 text-xs">
                        ₹{price.toLocaleString("en-IN")}
                      </span>
                      {planCount > 1 && (
                        <span className="text-slate-400 text-[10px] ml-1">
                          +{planCount - 1} more
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-300 text-xs">—</span>
                  )}
                </td>
                <td>
                  {accommodation.is_available ? (
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
                    {accommodation.email ? (
                      <a
                        href={`mailto:${accommodation.email}`}
                        title={accommodation.email}
                        className="grid place-items-center w-8 h-8 rounded-lg bg-blue-50 text-blue-500 hover:bg-blue-100 transition-colors"
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </a>
                    ) : null}
                    {accommodation.phone ? (
                      <a
                        href={`https://wa.me/${accommodation.phone.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={accommodation.phone}
                        className="grid place-items-center w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </a>
                    ) : null}
                    {!accommodation.email && !accommodation.phone && (
                      <span className="text-[10px] text-slate-300 italic">
                        No contact
                      </span>
                    )}
                  </div>
                </td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() =>
                        navigate(`/accommodation/edit/${accommodation.id}`)
                      }
                      className="p-2 hover:bg-blue-50 text-slate-300 hover:text-blue-600 rounded-xl transition-all"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(accommodation.id)}
                      className="p-2 hover:bg-red-50 text-slate-300 hover:text-red-600 rounded-xl transition-all"
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

      <ConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Accommodation"
        message="Are you sure you want to delete this hotel? This action cannot be undone."
        confirmText="Delete"
        loading={isDeleting}
      />
    </DashboardLayout>
  );
};

export default Accommodation;
