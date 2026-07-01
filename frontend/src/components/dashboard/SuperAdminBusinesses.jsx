import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "./DashboardLayout";
import Modal from "../common/Modal";
import {
  Building,
  Users,
  FileText,
  Crown,
  AlertTriangle,
  CheckCircle,
  UserCheck,
  UserX,
  Shield,
  Search,
  Loader2,
  Calendar,
  Plus,
  Mail,
  Lock,
  Zap,
  Pencil,
  Trash2,
  Eye,
  TrendingUp,
  BarChart,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  fetchSuperAdminBusinesses,
  updateBusinessStatus,
  createSuperAdminBusiness,
  updateSuperAdminBusiness,
  deleteSuperAdminBusiness,
  toggleBypassSubscription,
} from "../../api/superAdmin";
import { toast } from "react-toastify";
import CompactDataTable from "../common/CompactDataTable";

const SuperAdminBusinesses = () => {
  const { token } = useAuth();
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
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
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const fmtINR = (amount) => {
    const n = parseFloat(amount) || 0;
    if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`;
    if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
    if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
    return `₹${Math.round(n).toLocaleString("en-IN")}`;
  };

  const getStatusDisplay = (status) => {
    switch (status) {
      case "active":
        return {
          icon: UserCheck,
          color: "text-green-600",
          bgColor: "bg-green-50",
          label: "Active",
        };
      case "inactive":
        return {
          icon: UserX,
          color: "text-slate-400",
          bgColor: "bg-slate-50",
          label: "Inactive",
        };
      case "suspended":
        return {
          icon: Shield,
          color: "text-red-600",
          bgColor: "bg-red-50",
          label: "Suspended",
        };
      default:
        return {
          icon: UserCheck,
          color: "text-slate-400",
          bgColor: "bg-slate-50",
          label: status || "Unknown",
        };
    }
  };

  const toggleStatus = async (userId, currentStatus) => {
    try {
      const nextStatus = currentStatus === "active" ? "inactive" : "active";
      await updateBusinessStatus(token, userId, nextStatus);

      // Update local state
      setBusinesses((prev) =>
        prev.map((b) => (b.id === userId ? { ...b, status: nextStatus } : b)),
      );
      toast.success(`Account ${nextStatus} successfully`);
    } catch (err) {
      console.error("Failed to update status:", err);
      toast.error(err.message || "Failed to update status");
    }
  };

  const handleToggleBypass = async (businessId, currentBypass) => {
    try {
      const resp = await toggleBypassSubscription(token, businessId);
      setBusinesses((prev) =>
        prev.map((b) =>
          b.id === businessId
            ? { ...b, bypass_subscription: resp.bypass_subscription }
            : b,
        ),
      );
      toast.success(
        resp.bypass_subscription
          ? "Subscription restrictions removed"
          : "Subscription restrictions restored",
      );
    } catch (err) {
      toast.error(err.message || "Failed to update access");
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    setTablePage(1);
  };

  const handlePageSizeChange = (value) => {
    setPageSize(value);
    setPagination((prev) => ({ ...prev, perPage: value }));
    setTablePage(1);
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormData({ name: "", email: "", password: "" });
    setIsModalOpen(true);
  };

  const openEditModal = (business) => {
    setEditingId(business.id);
    setFormData({
      name: business.name,
      email: business.email,
      password: "",
    });
    setIsModalOpen(true);
  };

  const handleAddBusiness = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (editingId) {
        await updateSuperAdminBusiness(token, editingId, formData);
        setBusinesses((prev) =>
          prev.map((b) =>
            b.id === editingId
              ? { ...b, name: formData.name, email: formData.email }
              : b,
          ),
        );
        toast.success("Business updated successfully");
      } else {
        await createSuperAdminBusiness(token, formData);
        toast.success("Business created successfully");
      }
      setIsModalOpen(false);
      setFormData({ name: "", email: "", password: "" });
      setEditingId(null);
      if (!editingId) {
        if (tablePage !== 1) {
          setTablePage(1);
        } else {
          await loadBusinesses(1);
        }
      }
    } catch (err) {
      toast.error(err.message || "Failed to save business");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBusiness = async (id) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this business? All associated data will be lost.",
      )
    )
      return;
    try {
      await deleteSuperAdminBusiness(token, id);
      const nextTotal = Math.max(0, pagination.total - 1);
      const perPage = pagination.perPage || pageSize;
      const nextLastPage = Math.max(1, Math.ceil(nextTotal / perPage));
      const nextPage = Math.min(tablePage, nextLastPage);

      if (nextPage !== tablePage) {
        setTablePage(nextPage);
      } else {
        await loadBusinesses(nextPage);
      }
      toast.success("Business deleted successfully");
    } catch (err) {
      toast.error(err.message || "Failed to delete business");
    }
  };

  const loadBusinesses = async (page = 1) => {
    try {
      setLoading(true);
      const data = await fetchSuperAdminBusinesses(token, {
        page,
        perPage: pageSize,
        search: searchQuery.trim() || undefined,
      });
      const businessesPayload = Array.isArray(data)
        ? data
        : data.businesses || [];
      setBusinesses(businessesPayload);
      if (data.pagination) {
        setPagination({
          currentPage: data.pagination.current_page ?? page,
          lastPage: data.pagination.last_page ?? 1,
          total: data.pagination.total ?? 0,
          from: data.pagination.from ?? 0,
          to: data.pagination.to ?? 0,
          perPage: data.pagination.per_page ?? pageSize,
        });
      } else {
        setPagination({
          currentPage: page,
          lastPage: 1,
          total: data.businesses?.length ?? 0,
          from: data.businesses?.length ? 1 : 0,
          to: data.businesses?.length ?? 0,
          perPage: pageSize,
        });
      }
    } catch (err) {
      console.error("Failed to fetch businesses:", err);
      toast.error("Failed to load businesses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadBusinesses(tablePage);
  }, [token, tablePage, searchQuery, pageSize]);

  return (
    <DashboardLayout>
      <div className="mb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 leading-tight">
              Businesses
            </h1>
            <p className="text-slate-400 font-medium mt-1">
              Manage and monitor registered travel agency businesses.
            </p>
          </div>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-[#c7f135] text-[#10182a] px-6 py-3 rounded-xl font-bold shadow-lg shadow-[#c7f135]/40 hover:bg-[#b0dc00] transition-all text-sm w-fit"
          >
            <Plus className="w-4 h-4" />
            Add New Business
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by business name or email..."
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#c7f135]/20 transition-all placeholder:text-slate-300 placeholder:font-medium font-medium"
              value={searchQuery}
              onChange={handleSearchChange}
            />
          </div>
        </div>

        <CompactDataTable
          headers={[
            { label: "Business Details" },
            { label: "Status" },
            { label: "Activity" },
            { label: "Subscription Plan" },
            { label: "Revenue" },
            { label: "Free Access" },
            { label: "Joined" },
            { label: "Actions", className: "text-right" },
          ]}
          loading={loading}
          loadingText="Loading businesses..."
          hasRows={businesses.length > 0}
          emptyIcon={<Building className="w-8 h-8" />}
          emptyTitle="No businesses found"
          emptyDescription={
            searchQuery
              ? "Try a different search term."
              : "No businesses have registered yet."
          }
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
          {businesses.map((business) => {
            const statusDisplay = getStatusDisplay(business.status);
            const StatusIcon = statusDisplay.icon;

            return (
              <tr
                key={business.id}
                className="hover:bg-slate-50/50 group transition-colors"
              >
                <td>
                  <div>
                    <div className="font-bold text-slate-900">
                      {business.name}
                    </div>
                    <div className="text-slate-400 text-[10px] mt-0.5">
                      {business.email}
                    </div>
                    {business.phone && (
                      <div className="text-slate-400 text-[10px] font-medium mt-0.5">
                        {business.phone}
                      </div>
                    )}
                  </div>
                </td>
                <td>
                  <button
                    onClick={() => toggleStatus(business.id, business.status)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 ${statusDisplay.bgColor} ${statusDisplay.color}`}
                  >
                    <StatusIcon className="w-3.5 h-3.5" />
                    {statusDisplay.label}
                  </button>
                </td>
                <td>
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1">
                        Teams
                      </span>
                      <div className="flex items-center gap-1 text-slate-900 font-bold">
                        <Users className="w-3.5 h-3.5 text-slate-300" />
                        {business.team_members_count}
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1">
                        Trips
                      </span>
                      <div className="flex items-center gap-1 text-slate-900 font-bold">
                        <FileText className="w-3.5 h-3.5 text-slate-300" />
                        {business.trips_count}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  {business.bypass_subscription ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-lg bg-violet-50 flex items-center justify-center">
                        <Zap className="w-3 h-3 text-violet-600 fill-violet-600" />
                      </div>
                      <span className="text-[11px] font-black uppercase tracking-wider text-violet-600">
                        Full Access
                      </span>
                    </div>
                  ) : business.plan ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        {business.plan.is_trial ? (
                          <div className="w-5 h-5 rounded-lg bg-yellow-50 flex items-center justify-center">
                            <Crown className="w-3 h-3 text-yellow-600" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-lg bg-green-50 flex items-center justify-center">
                            <CheckCircle className="w-3 h-3 text-green-600" />
                          </div>
                        )}
                        <span
                          className={`text-[11px] font-black uppercase tracking-wider ${
                            business.plan.is_expired
                              ? "text-red-500"
                              : "text-slate-900"
                          }`}
                        >
                          {business.plan.plan_name}
                        </span>
                        {business.plan.is_expired && (
                          <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                        )}
                      </div>
                      {business.plan.expires_at && (
                        <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1 ml-6">
                          <Calendar className="w-3 h-3" />
                          Expires:{" "}
                          {new Date(
                            business.plan.expires_at,
                          ).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                      No active plan
                    </span>
                  )}
                </td>
                <td>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-emerald-600">
                      {fmtINR(business.total_revenue || 0)}
                    </span>
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                      Total Rev
                    </span>
                  </div>
                </td>
                <td>
                  <button
                    onClick={() =>
                      handleToggleBypass(
                        business.id,
                        business.bypass_subscription,
                      )
                    }
                    title={
                      business.bypass_subscription
                        ? "Remove restrictions: ON — click to restore"
                        : "Remove restrictions: OFF — click to allow all paid actions"
                    }
                    className={`group relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 ${
                      business.bypass_subscription
                        ? "bg-violet-50 text-violet-600"
                        : "bg-slate-50 text-slate-400 hover:bg-violet-50 hover:text-violet-500"
                    }`}
                  >
                    <Zap
                      className={`w-3.5 h-3.5 ${
                        business.bypass_subscription
                          ? "fill-violet-500 text-violet-500"
                          : ""
                      }`}
                    />
                    {business.bypass_subscription ? "On" : "Off"}
                  </button>
                </td>
                <td>
                  <div className="text-[11px] font-bold text-slate-500">
                    {new Date(business.created_at).toLocaleDateString(
                      undefined,
                      {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      },
                    )}
                  </div>
                </td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      to={`/businesses/${business.id}`}
                      className="p-2 hover:bg-slate-50 text-slate-300 hover:text-slate-600 rounded-xl transition-all"
                      title="View Strategy & Insights"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => openEditModal(business)}
                      className="p-2 hover:bg-blue-50 text-slate-300 hover:text-blue-600 rounded-xl transition-all"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteBusiness(business.id)}
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

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingId(null);
        }}
        title="Business"
        isEditing={!!editingId}
        onSubmit={handleAddBusiness}
        submitButtonText={editingId ? "Update Business" : "Create Business"}
        submitting={submitting}
      >
        <div className="space-y-6">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">
              Admin Name
            </label>
            <div className="relative group">
              <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#c7f135]/20 transition-all placeholder:text-slate-300 placeholder:font-medium"
                placeholder="Full Name"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">
              Email Address
            </label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#c7f135]/20 transition-all placeholder:text-slate-300 placeholder:font-medium"
                placeholder="email@example.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">
              {editingId
                ? "Update Password (leave blank to keep current)"
                : "Password"}
            </label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#c7f135]/20 transition-all placeholder:text-slate-300 placeholder:font-medium"
                placeholder="••••••••"
                required={!editingId}
              />
            </div>
            {!editingId && (
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-2 ml-1">
                Minimum 8 characters required
              </p>
            )}
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
};

export default SuperAdminBusinesses;
