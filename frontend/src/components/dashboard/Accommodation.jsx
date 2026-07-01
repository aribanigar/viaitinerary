import React, { useState, useEffect } from "react";
import DashboardLayout from "./DashboardLayout";
import ConfirmationModal from "../common/ConfirmationModal";
import PageHeader from "../common/PageHeader";
import { Plus, Hotel, Trash2, Pencil, Search, Mail, Phone } from "lucide-react";
import { getHotels, deleteHotel } from "../../api/hotels";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";
import CompactDataTable from "../common/CompactDataTable";

const Accommodation = () => {
  const { token } = useAuth();
  const [accommodations, setAccommodations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [targetId, setTargetId] = useState(null);
  const [pageSize, setPageSize] = useState(25);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    lastPage: 1,
    total: 0,
    from: 0,
    to: 0,
    perPage: 25,
  });

  const navigate = useNavigate();

  useEffect(() => {
    if (token) {
      fetchHotels(1);
    }
  }, [token, searchQuery, pageSize]);

  const fetchHotels = async (page = 1) => {
    try {
      setLoading(true);
      const resp = await getHotels(token, {
        page,
        per_page: pageSize,
        search: searchQuery,
      });
      setAccommodations(resp.data);
      setPagination({
        currentPage: resp.current_page,
        lastPage: resp.last_page,
        total: resp.total,
        from: resp.from,
        to: resp.to,
        perPage: resp.per_page,
      });
    } catch (error) {
      toast.error(error.message || "Error fetching hotels");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (id) => {
    setTargetId(id);
    setDeleteModalOpen(true);
  };

  const handlePageSizeChange = (value) => {
    setPageSize(value);
    setPagination((prev) => ({ ...prev, perPage: value }));
  };

  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      await deleteHotel(targetId, token);
      setAccommodations((prev) => prev.filter((a) => a.id !== targetId));
      setPagination((prev) => ({ ...prev, total: prev.total - 1 }));
      toast.success("Accommodation deleted successfully");
      setDeleteModalOpen(false);
    } catch (error) {
      toast.error(error.message || "Error deleting hotel");
    } finally {
      setIsDeleting(false);
      setTargetId(null);
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Accommodation"
        description="Manage your hotel partners and stay options."
      >
        <button
          onClick={() => navigate("/accommodation/add")}
          className="flex items-center gap-2 bg-[#c7f135] text-[#10182a] px-6 py-3 rounded-xl font-bold shadow-lg shadow-[#c7f135]/40 hover:bg-[#b0dc00] transition-all text-sm w-fit"
        >
          <Plus className="w-4 h-4" />
          Add New Accommodation
        </button>
      </PageHeader>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or city..."
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#c7f135]/20 transition-all placeholder:text-slate-300 placeholder:font-medium font-medium"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <CompactDataTable
          headers={[
            { label: "Accommodation Details" },
            { label: "Contact Info" },
            { label: "Created By" },
            { label: "Actions", className: "text-right" },
          ]}
          loading={loading}
          loadingText="Loading stays..."
          hasRows={accommodations.length > 0}
          emptyIcon={<Hotel className="w-8 h-8" />}
          emptyTitle="No accommodations found"
          emptyDescription={
            searchQuery
              ? "Try a different search term."
              : "Start by adding your first hotel or stay option."
          }
          pagination={pagination}
          onPageChange={fetchHotels}
          onPageSizeChange={handlePageSizeChange}
        >
          {accommodations.map((accommodation) => (
            <tr
              key={accommodation.id}
              className="hover:bg-slate-50/50 group transition-colors"
            >
              <td>
                <div>
                  <div className="font-bold text-slate-900 capitalize">
                    {accommodation.name}
                  </div>
                  <div className="text-slate-400 text-xs mt-1">
                    {accommodation.city}
                  </div>
                </div>
              </td>
              <td>
                <div className="flex flex-col gap-1">
                  {accommodation.email ? (
                    <a
                      href={`mailto:${accommodation.email}`}
                      className="flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors w-fit group/link"
                    >
                      <Mail className="w-3.5 h-3.5 text-blue-500 group-hover/link:animate-pulse" />
                      <span className="text-xs font-bold truncate max-w-[150px]">
                        {accommodation.email}
                      </span>
                    </a>
                  ) : (
                    <span className="text-[10px] text-slate-300 italic">
                      No email
                    </span>
                  )}
                  {accommodation.phone ? (
                    <a
                      href={`https://wa.me/${accommodation.phone.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-slate-600 hover:text-emerald-600 transition-colors w-fit group/link"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-500 group-hover/link:animate-pulse" />
                      <span className="text-xs font-bold">
                        {accommodation.phone}
                      </span>
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
                    {accommodation.creator_name || "Admin"}
                  </span>
                  <span className="text-slate-400 text-[10px] font-medium">
                    {accommodation.creator_email}
                  </span>
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
          ))}
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
