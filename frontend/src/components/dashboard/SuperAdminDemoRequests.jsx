import React, { useState, useEffect } from "react";
import DashboardLayout from "./DashboardLayout";
import {
  Search,
  Calendar,
  Mail,
  Phone,
  Building,
  Users,
  MapPin,
  Trash2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  fetchDemoRequests,
  updateDemoRequestStatus,
  deleteDemoRequest,
} from "../../api/demo";
import { toast } from "react-toastify";
import CompactDataTable from "../common/CompactDataTable";

const SuperAdminDemoRequests = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    lastPage: 1,
    total: 0,
    from: 0,
    to: 0,
    perPage: 25,
  });

  const loadRequests = async (page = 1) => {
    try {
      setLoading(true);
      const resp = await fetchDemoRequests(token, {
        page,
        per_page: pageSize,
      });
      setRequests(resp.data);
      setPagination({
        currentPage: resp.current_page,
        lastPage: resp.last_page,
        total: resp.total,
        from: resp.from,
        to: resp.to,
        perPage: resp.per_page,
      });
    } catch (error) {
      toast.error("Failed to load demo requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadRequests(1);
  }, [token, pageSize]);

  const handlePageSizeChange = (value) => {
    setPageSize(value);
    setPagination((prev) => ({ ...prev, perPage: value }));
  };

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      await updateDemoRequestStatus(id, newStatus, token);
      toast.success(`Status updated to ${newStatus}`);
      loadRequests(pagination.currentPage);
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this demo request?")) {
      try {
        await deleteDemoRequest(id, token);
        toast.success("Request deleted successfully");
        loadRequests(pagination.currentPage);
      } catch (error) {
        toast.error("Failed to delete request");
      }
    }
  };

  const filteredRequests = requests.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.email.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "bg-amber-100 text-amber-600";
      case "contacted":
        return "bg-blue-100 text-blue-600";
      case "completed":
        return "bg-emerald-100 text-emerald-600";
      case "cancelled":
        return "bg-slate-100 text-slate-600";
      default:
        return "bg-slate-100 text-slate-600";
    }
  };

  const parseScheduledAt = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value !== "string") return null;

    const s = value.trim();
    if (!s) return null;

    // API commonly returns "DD-MM-YYYY HH:mm" (e.g., "25-03-2026 19:30")
    const dmyHm = s.match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
    if (dmyHm) {
      const day = Number(dmyHm[1]);
      const month = Number(dmyHm[2]);
      const year = Number(dmyHm[3]);
      const hour = Number(dmyHm[4] ?? 0);
      const minute = Number(dmyHm[5] ?? 0);
      const dt = new Date(year, month - 1, day, hour, minute);
      return Number.isNaN(dt.getTime()) ? null : dt;
    }

    // ISO / other formats
    const dt = new Date(s);
    return Number.isNaN(dt.getTime()) ? null : dt;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "Not scheduled";
    const dt = parseScheduledAt(dateStr);
    if (!dt) return "Not scheduled";
    return dt.toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  return (
    <DashboardLayout>
      <div className="mb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 leading-tight">
              Demo Requests
            </h1>
            <p className="text-slate-400 font-medium mt-1">
              Manage and track all demo requests from potential clients.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, company or email..."
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-300 placeholder:font-medium font-medium"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <CompactDataTable
          headers={[
            { label: "Requester Details" },
            { label: "Company Info" },
            { label: "Scheduled For" },
            { label: "Status" },
            { label: "Actions", className: "text-right" },
          ]}
          loading={loading}
          loadingText="Loading requests..."
          hasRows={filteredRequests.length > 0}
          emptyIcon={<Calendar className="w-8 h-8" />}
          emptyTitle="No demo requests found"
          emptyDescription={
            searchQuery
              ? "Try a different search term."
              : "There are no pending demo requests at the moment."
          }
          pagination={pagination}
          onPageChange={loadRequests}
          onPageSizeChange={handlePageSizeChange}
        >
          {filteredRequests.map((request) => (
            <tr
              key={request.id}
              className="hover:bg-slate-50/50 group transition-colors"
            >
              <td>
                <div className="flex flex-col">
                  <span className="font-bold text-slate-900 capitalize">
                    {request.name}
                  </span>
                  <div className="flex items-center gap-2 mt-1 text-slate-400 text-xs">
                    <Mail className="w-3 h-3" />
                    <span>{request.email}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-slate-400 text-xs">
                    <Phone className="w-3 h-3" />
                    <span>{request.contact_number}</span>
                  </div>
                </div>
              </td>
              <td>
                <div className="flex flex-col">
                  <span className="font-bold text-slate-700">
                    {request.company_name}
                  </span>
                  <div className="flex items-center gap-2 mt-1 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                    <Building className="w-3 h-3 text-slate-300" />
                    <span>{request.agency_type}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                    <Users className="w-3 h-3 text-slate-300" />
                    <span>{request.no_of_employees} Employees</span>
                  </div>
                </div>
              </td>
              <td>
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-bold">
                    {formatDate(request.scheduled_at)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-slate-400">
                  <MapPin className="w-3 h-3" />
                  <span className="text-[10px] uppercase font-bold tracking-wider">
                    {request.office_location}
                  </span>
                </div>
              </td>
              <td>
                <select
                  value={request.status}
                  onChange={(e) =>
                    handleStatusUpdate(request.id, e.target.value)
                  }
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer ${getStatusColor(request.status)}`}
                >
                  <option value="pending">Pending</option>
                  <option value="contacted">Contacted</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </td>
              <td className="text-right">
                <button
                  onClick={() => handleDelete(request.id)}
                  className="p-2 hover:bg-red-50 text-slate-300 hover:text-red-600 rounded-xl transition-all"
                  title="Delete Request"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </CompactDataTable>
      </div>
    </DashboardLayout>
  );
};

export default SuperAdminDemoRequests;
