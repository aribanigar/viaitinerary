import React, { useState, useEffect } from "react";
import DashboardLayout from "./DashboardLayout";
import {
  Mail,
  Phone,
  MapPin,
  Users,
  Calendar,
  IndianRupee,
  MessageSquare,
  CheckCircle,
  UserPlus,
  Filter,
  Search,
  X,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  fetchPublicInquiries,
  assignInquiry,
  fetchSuperAdminBusinesses,
} from "../../api/superAdmin";
import { toast } from "react-toastify";
import CompactDataTable from "../common/CompactDataTable";

const PublicInquiries = () => {
  const { token } = useAuth();
  const [inquiries, setInquiries] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [selectedAdminId, setSelectedAdminId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    status: "all",
    assigned: "unassigned",
  });
  const [tablePage, setTablePage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    lastPage: 1,
    total: 0,
    from: 0,
    to: 0,
    perPage: 25,
  });

  useEffect(() => {
    fetchAdmins();
  }, [token]);

  useEffect(() => {
    setTablePage(1);
  }, [filters, searchQuery, pageSize]);

  useEffect(() => {
    if (token) fetchData(tablePage);
  }, [token, filters, searchQuery, tablePage, pageSize]);

  const fetchData = async (page = 1) => {
    try {
      setLoading(true);
      const data = await fetchPublicInquiries(token, {
        ...filters,
        search: searchQuery.trim() || undefined,
        page,
        per_page: pageSize,
      });
      setInquiries(data.data || []);
      setPagination({
        currentPage: data.current_page ?? page,
        lastPage: data.last_page ?? 1,
        total: data.total ?? 0,
        from: data.from ?? 0,
        to: data.to ?? 0,
        perPage: data.per_page ?? pageSize,
      });
    } catch (err) {
      console.error("Failed to fetch inquiries:", err);
      toast.error("Failed to load inquiries");
    } finally {
      setLoading(false);
    }
  };

  const fetchAdmins = async () => {
    try {
      const data = await fetchSuperAdminBusinesses(token, { all: true });
      const businesses = Array.isArray(data) ? data : data.businesses || [];
      setAdmins(businesses.filter((admin) => admin.status === "active"));
    } catch (err) {
      console.error("Failed to fetch admins:", err);
    }
  };

  const handleAssignClick = (inquiry) => {
    setSelectedInquiry(inquiry);
    setSelectedAdminId("");
    setShowAssignModal(true);
  };

  const handleAssignSubmit = async () => {
    if (!selectedAdminId) {
      toast.error("Please select an admin");
      return;
    }

    try {
      setAssigning(true);
      await assignInquiry(token, selectedInquiry.id, selectedAdminId);
      toast.success("Inquiry assigned successfully");
      setShowAssignModal(false);
      fetchData(tablePage);
    } catch (err) {
      console.error("Failed to assign inquiry:", err);
      toast.error("Failed to assign inquiry");
    } finally {
      setAssigning(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      new: "bg-blue-50 text-blue-600",
      contacted: "bg-amber-50 text-amber-600",
      quoted: "bg-purple-50 text-purple-600",
      converted: "bg-green-50 text-green-600",
      closed: "bg-slate-100 text-slate-400",
    };
    return colors[status] || colors.new;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

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
              Public Leads
            </h1>
            <p className="text-slate-400 font-medium mt-1">
              Manage and assign inquiries from the landing page
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden mb-8">
        <div className="p-6 border-b border-slate-50 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by client, email, phone or destination..."
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-300"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-3 rounded-xl transition-all ${
              showFilters
                ? "bg-blue-100 text-blue-600"
                : "bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            }`}
            title="Toggle filters"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>

        {showFilters && (
          <div className="px-6 pb-4">
            <div className="flex gap-4 items-center flex-wrap">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) =>
                    setFilters({ ...filters, status: e.target.value })
                  }
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="quoted">Quoted</option>
                  <option value="converted">Converted</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Assignment
                </label>
                <select
                  value={filters.assigned}
                  onChange={(e) =>
                    setFilters({ ...filters, assigned: e.target.value })
                  }
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="all">All Leads</option>
                  <option value="unassigned">Unassigned</option>
                  <option value="assigned">Assigned</option>
                </select>
              </div>
            </div>
          </div>
        )}

        <CompactDataTable
          headers={[
            { label: "Client Details", className: "whitespace-nowrap" },
            { label: "Destination & Trip", className: "whitespace-nowrap" },
            {
              label: "Pax & Budget",
              className: "text-center whitespace-nowrap",
            },
            { label: "Status", className: "text-center whitespace-nowrap" },
            { label: "Assignment", className: "text-right whitespace-nowrap" },
          ]}
          loading={loading}
          loadingText="Loading public leads..."
          hasRows={inquiries.length > 0}
          emptyIcon={<Mail className="w-8 h-8" />}
          emptyTitle="No public leads found"
          pagination={{
            currentPage: pagination.currentPage,
            lastPage: pagination.lastPage,
            total: pagination.total,
            from: pagination.from,
            to: pagination.to,
            perPage: pagination.perPage,
          }}
          onPageChange={setTablePage}
          onPageSizeChange={handlePageSizeChange}
        >
          {inquiries.map((inquiry) => (
            <React.Fragment key={inquiry.id}>
              <tr className="hover:bg-slate-50/50 group transition-colors">
                <td>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                      <span className="font-black text-lg">
                        {inquiry.client_name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">
                        {inquiry.client_name}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                        <Mail className="w-3 h-3" />
                        {inquiry.client_email}
                      </div>
                      {inquiry.client_phone && (
                        <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                          <Phone className="w-3 h-3" />
                          {inquiry.client_phone}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td>
                  <div>
                    <div className="flex items-center gap-2 text-slate-900 font-bold">
                      <MapPin className="w-4 h-4 text-blue-500" />
                      {inquiry.destination}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(inquiry.start_date)}
                    </div>
                  </div>
                </td>
                <td className="text-center">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 text-slate-600 text-[11px] font-bold rounded-lg border border-slate-100">
                      <Users className="w-3 h-3" />
                      {inquiry.pax} Pax
                    </div>
                    <div className="flex items-center justify-center gap-1 font-black text-blue-600">
                      <IndianRupee className="w-3 h-3" />
                      {inquiry.approximate_budget}
                    </div>
                  </div>
                </td>
                <td className="text-center">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-black rounded-lg uppercase tracking-wider ${getStatusColor(inquiry.status)}`}
                  >
                    {inquiry.status}
                  </span>
                </td>
                <td className="text-right">
                  {inquiry.assigned_to ? (
                    <div className="inline-flex flex-col items-end">
                      <span className="px-3 py-1 bg-green-50 text-green-600 text-[10px] font-black rounded-lg uppercase tracking-wider mb-1">
                        Assigned
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {inquiry.assigned_admin?.name || "Admin"}
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleAssignClick(inquiry)}
                      className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/10"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Assign Lead
                    </button>
                  )}
                </td>
              </tr>
              {inquiry.special_requests && (
                <tr className="bg-slate-50/30">
                  <td colSpan="5" className="px-6 py-3">
                    <div className="flex items-start gap-3 bg-white/50 border border-slate-100 rounded-xl p-3">
                      <MessageSquare className="w-4 h-4 text-slate-300 mt-0.5 shrink-0" />
                      <p className="text-xs text-slate-500 font-medium leading-relaxed">
                        {inquiry.special_requests}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </CompactDataTable>
      </div>

      {showAssignModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100">
            <div className="flex justify-between items-center p-8 border-b border-slate-50">
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  Assign Lead
                </h3>
                <p className="text-slate-400 text-sm font-medium mt-1">
                  Choose an admin to handle this inquiry
                </p>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-8">
              <div className="mb-8">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1">
                  Select Business / Admin
                </label>
                <div className="relative">
                  <select
                    value={selectedAdminId}
                    onChange={(e) => setSelectedAdminId(e.target.value)}
                    className="w-full pl-4 pr-10 py-4 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">-- Select an admin --</option>
                    {admins.map((admin) => (
                      <option key={admin.id} value={admin.id}>
                        {admin.name} ({admin.email})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="flex-1 px-6 py-4 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100 transition-all font-bold text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignSubmit}
                  disabled={assigning || !selectedAdminId}
                  className="flex-1 px-6 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all font-bold text-sm shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                >
                  {assigning ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  {assigning ? "Assigning..." : "Confirm Assignment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default PublicInquiries;
