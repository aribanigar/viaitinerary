import React, { useState, useEffect, useMemo } from "react";
import DashboardLayout from "./DashboardLayout";
import ConfirmationModal from "../common/ConfirmationModal";
import PageHeader from "../common/PageHeader";
import {
  Plus,
  MapPin,
  Trash2,
  Pencil,
  Search,
  ImageIcon,
  ImageOff,
  ListChecks,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { fetchDestinations, deleteDestination } from "../../api/destinations";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import CompactDataTable from "../common/CompactDataTable";

// Client-side pagination/filtering: an agency's destination catalog is small
// enough to fetch once and filter instantly, matching Accommodation/Vehicles.
const FETCH_ALL_PAGE_SIZE = 1000;

const Destinations = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [targetId, setTargetId] = useState(null);
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  const loadDestinations = async () => {
    try {
      setLoading(true);
      const resp = await fetchDestinations(token, { per_page: FETCH_ALL_PAGE_SIZE });
      setDestinations(resp.data);
    } catch (error) {
      toast.error(error.message || "Failed to load destinations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadDestinations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return destinations;
    return destinations.filter((d) => d.name.toLowerCase().includes(q));
  }, [destinations, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, pageSize]);

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

  const totalActivities = useMemo(
    () => destinations.reduce((sum, d) => sum + (d.activities || []).length, 0),
    [destinations],
  );
  const withPhotoCount = destinations.filter((d) => d.image_url).length;

  const stats = [
    {
      label: "Total Destinations",
      value: destinations.length.toString(),
      change: "In your catalog",
      icon: MapPin,
      bgColor: "bg-[#e7f63c]",
      iconColor: "text-[#181c22]",
    },
    {
      label: "Total Activities",
      value: totalActivities.toString(),
      change: "Across all destinations",
      icon: ListChecks,
      bgColor: "bg-[#181c22]",
      iconColor: "text-white",
    },
    {
      label: "With Photos",
      value: withPhotoCount.toString(),
      change: "Ready to showcase",
      icon: ImageIcon,
      bgColor: "bg-[#181c22]",
      iconColor: "text-white",
    },
    {
      label: "Missing Photos",
      value: (destinations.length - withPhotoCount).toString(),
      change: "Could use a photo",
      icon: ImageOff,
      bgColor: "bg-[#181c22]",
      iconColor: "text-white",
    },
  ];

  const handleDeleteClick = (id) => {
    setTargetId(id);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      await deleteDestination(targetId, token);
      setDestinations((prev) => prev.filter((d) => d.id !== targetId));
      toast.success("Destination deleted successfully");
      setDeleteModalOpen(false);
    } catch (error) {
      toast.error(error.message || "Failed to delete destination");
    } finally {
      setIsDeleting(false);
      setTargetId(null);
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Destinations"
        description="Manage and explore travel destinations for your trips."
      >
        <button
          onClick={() => navigate("/destinations/add")}
          className="flex items-center gap-2 bg-[#e7f63c] text-[#181c22] px-6 py-3 rounded-2xl font-bold shadow-lg shadow-[#e7f63c]/40 hover:bg-[#d4e42e] transition-all text-sm w-fit"
        >
          <Plus className="w-4 h-4" />
          Add New Destination
        </button>
      </PageHeader>

      {!loading && (
        <div className="flex flex-wrap items-center gap-2 mb-8">
          {stats.map((stat, i) => (
            <div
              key={i}
              title={stat.change}
              className="flex items-center gap-2 h-11 pl-1.5 pr-3.5 rounded-2xl border border-black/5 bg-white shadow-sm"
            >
              <span
                className={`grid place-items-center w-8 h-8 rounded-xl shrink-0 ${stat.bgColor}`}
              >
                <stat.icon className={`w-4 h-4 ${stat.iconColor}`} />
              </span>
              <span className="text-xs font-bold text-[#181c22] whitespace-nowrap">
                {stat.label}
              </span>
              <span className="grid place-items-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#f3f3f4] font-black text-[#181c22] text-[11px]">
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-black/5 flex flex-wrap gap-2 justify-between items-center bg-[#f3f3f4]/60">
          <h3 className="text-sm font-bold text-[#181c22] uppercase tracking-widest">
            All Destinations
          </h3>
          <span className="text-[10px] font-bold text-[#8a93a2] uppercase tracking-widest">
            {filtered.length} of {destinations.length}
          </span>
        </div>
        <div className="p-6 border-b border-black/5">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name..."
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#e7f63c]/20 transition-all placeholder:text-slate-300 placeholder:font-medium"
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
          hasRows={pageItems.length > 0}
          emptyIcon={<MapPin className="w-8 h-8" />}
          emptyTitle="No destinations found"
          emptyDescription={
            searchQuery
              ? "Try a different search term."
              : "Start by adding your first travel destination."
          }
          pagination={pagination}
          onPageChange={(p) => setCurrentPage(p)}
          onPageSizeChange={(size) => setPageSize(size)}
        >
          {pageItems.map((destination) => (
            <tr
              key={destination.id}
              className="hover:bg-slate-50/50 group transition-colors"
            >
              <td>
                <button
                  onClick={() => navigate(`/destinations/edit/${destination.id}`)}
                  className="flex items-center gap-3 text-left w-full"
                >
                  <div className="w-11 h-11 rounded-xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                    {destination.image_url ? (
                      <img
                        src={destination.image_url}
                        alt={destination.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <MapPin className="w-4 h-4 text-slate-300" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 capitalize truncate hover:underline">
                      {destination.name}
                    </div>
                    <div className="text-slate-400 text-[11px] mt-0.5 font-medium">
                      {(destination.activities || []).length} total activities
                    </div>
                  </div>
                </button>
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
                  {(destination.activities || []).length === 0 && (
                    <span className="text-[10px] text-slate-300 italic">
                      No activities yet
                    </span>
                  )}
                </div>
              </td>
              <td className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => navigate(`/destinations/edit/${destination.id}`)}
                    className="p-2 hover:bg-blue-50 text-slate-300 hover:text-blue-600 rounded-xl transition-all"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(destination.id)}
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

      <ConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Destination"
        message="Are you sure you want to delete this destination? This action cannot be undone."
        confirmText="Delete"
        loading={isDeleting}
      />
    </DashboardLayout>
  );
};

export default Destinations;
