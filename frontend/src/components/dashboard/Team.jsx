import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import DashboardLayout from "./DashboardLayout";
import Modal from "../common/Modal";
import { PhoneInput } from "react-international-phone";
import "react-international-phone/style.css";
import {
  Plus,
  Users,
  Trash2,
  Pencil,
  Search,
  Loader2,
  Mail,
  Phone,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  getTeams,
  createTeam,
  updateTeam,
  deleteTeam,
  toggleTeamStatus,
} from "../../api/teams";
import { assignIncludedMember } from "../../api/subscription";
import { fetchSubscriptionStatus } from "../../api/trips";
import { useAuth } from "../../context/AuthContext";
import { useSubscription } from "../../context/SubscriptionContext";
import { toast } from "react-toastify";
import SubscriptionBanner from "../common/SubscriptionBanner";
import CompactDataTable from "../common/CompactDataTable";

const Team = () => {
  const { token, user } = useAuth();
  const { setSubscriptionTarget } = useSubscription();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [subscription, setSubscription] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
  });

  useEffect(() => {
    if (token) {
      fetchTeams();
      fetchSub();
    }
  }, [token]);

  const fetchSub = async () => {
    try {
      const subData = await fetchSubscriptionStatus(token);
      setSubscription(subData);
    } catch (err) {
      console.error("Failed to load subscription:", err);
    }
  };

  const fetchTeams = async () => {
    try {
      const data = await getTeams(token);
      setTeams(data);
    } catch (error) {
      console.error("Error fetching teams:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTeams = teams.filter(
    (team) =>
      team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (team.role &&
        team.role.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (team.user?.email &&
        team.user.email.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEdit = (team) => {
    setEditingId(team.id);
    setFormData({
      name: team.name,
      email: team.user?.email || "",
      password: "", // Don't populate password for security
      confirmPassword: "",
      phone: team.phone || "",
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this team member?")) {
      try {
        await deleteTeam(id, token);
        setTeams((prev) => prev.filter((t) => t.id !== id));
      } catch (error) {
        console.error("Error deleting team member:", error);
      }
    }
  };

  const handleToggleStatus = async (team) => {
    try {
      const updated = await toggleTeamStatus(team.id, token);
      setTeams((prev) => prev.map((t) => (t.id === team.id ? updated : t)));
      toast.success(
        `Team member ${updated.status === "Active" ? "activated" : "deactivated"} successfully`,
      );
    } catch (error) {
      console.error("Error toggling team status:", error);
      toast.error("Failed to update team status");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.phone || formData.phone.length < 5) {
      toast.error("Phone number is required");
      return;
    }

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    try {
      const submitData = { ...formData };

      // Remove confirmPassword as it's not needed in the API
      delete submitData.confirmPassword;

      // Only include password if it's provided (for updates)
      if (!submitData.password) {
        delete submitData.password;
      }

      if (editingId) {
        const updated = await updateTeam(editingId, submitData, token);
        setTeams((prev) => prev.map((t) => (t.id === editingId ? updated : t)));
        toast.success("Team member updated successfully");
      } else {
        const created = await createTeam(submitData, token);
        setTeams((prev) => [...prev, created]);

        if (subscription?.bypass_subscription) {
          toast.success("Team member created successfully");
        } else {
          toast.success("Team member created. Redirecting to pricing...");
          setSubscriptionTarget(created);
          setTimeout(() => {
            navigate(`/pricing?member_user_id=${created.user_id}`);
          }, 1500);
        }
      }
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
        phone: "",
      });
    } catch (error) {
      console.error("Error saving team member:", error);
      toast.error(error.message);
    }
  };

  const handleAssignIncludedSeat = async (team) => {
    if (!subscription) {
      toast.error("Subscription info not available.");
      return;
    }

    try {
      await assignIncludedMember(team.user_id, token);
      toast.success("Seat assigned to " + team.name + " successfully.");
      // Refresh teams and subscription status
      await fetchTeams();
      await fetchSub();
    } catch (err) {
      console.error("Assign seat failed:", err);
      const msg = err?.message || "Failed to assign seat";
      toast.error(msg);
    }
  };

  return (
    <DashboardLayout>
      <SubscriptionBanner subscription={subscription} />

      {/* Show assign-banner when admin has included seats and there are pending members */}
      {(() => {
        try {
          const planKey = subscription?.plan_key;
          const plan = subscription?.available_plans?.[planKey];
          const limit = plan?.team_member_limit ?? 0;
          const assignedCount = teams.filter(
            (t) =>
              t.user?.subscription &&
              t.user.subscription.status === "active" &&
              t.user.subscription.plan_key === planKey,
          ).length;
          const seatsAvailable = limit - assignedCount;
          const pendingCount = teams.filter(
            (t) => t.user?.subscription?.status === "pending",
          ).length;

          if (seatsAvailable > 0 && pendingCount > 0) {
            return (
              <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-100">
                <div className="text-sm font-bold text-amber-800">
                  You have {seatsAvailable} seat
                  {seatsAvailable !== 1 ? "s" : ""} available. Which team member
                  would you like to include?
                </div>
              </div>
            );
          }
        } catch (e) {
          // ignore
        }
        return null;
      })()}

      <div className="mb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 leading-tight">
              Team Management
            </h1>
            <p className="text-slate-400 font-medium mt-1">
              Manage your travel agency team members and their information.
            </p>
          </div>
          <button
            onClick={() => {
              setEditingId(null);
              setFormData({
                name: "",
                email: "",
                password: "",
                confirmPassword: "",
                phone: "",
              });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-[#2563EB] text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-600 transition-all text-sm w-fit"
          >
            <Plus className="w-4 h-4" />
            Add Team Member
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-300 placeholder:font-medium font-medium"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <CompactDataTable
          headers={[
            { label: "Team Member Details" },
            { label: "Contact Information" },
            { label: "Status & Trips" },
            { label: "Actions", className: "text-right" },
          ]}
          loading={loading}
          loadingText="Loading team members..."
          hasRows={filteredTeams.length > 0}
          emptyIcon={<Users className="w-8 h-8" />}
          emptyTitle="No team members found"
          emptyDescription={
            searchQuery
              ? "Try a different search term."
              : "Start by adding your first team member."
          }
        >
          {filteredTeams.map((team) => (
            <tr
              key={team.id}
              className="hover:bg-slate-50/50 group transition-colors"
            >
              <td>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 overflow-hidden">
                    {team.image_url ? (
                      <img
                        src={team.image_url}
                        alt={team.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Users className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 capitalize">
                      {team.name}
                    </div>
                    {team.role && (
                      <div className="text-slate-400 text-xs font-medium mt-1">
                        {team.role}
                      </div>
                    )}
                  </div>
                </div>
              </td>
              <td>
                <div className="space-y-1">
                  {team.user?.email && (
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Mail className="w-3 h-3" />
                      {team.user.email}
                    </div>
                  )}
                  {team.phone && (
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Phone className="w-3 h-3" />
                      {team.phone}
                    </div>
                  )}
                </div>
              </td>
              <td>
                <div className="space-y-1">
                  <button
                    onClick={() => handleToggleStatus(team)}
                    className={`text-xs font-medium px-2 py-1 rounded-full w-fit cursor-pointer transition-colors ${
                      team.status === "Active"
                        ? "bg-green-50 text-green-700 hover:bg-green-100"
                        : "bg-red-50 text-red-700 hover:bg-red-100"
                    }`}
                  >
                    {team.status}
                  </button>
                  <div className="text-xs text-slate-600">
                    {team.trips_count} trip
                    {team.trips_count !== 1 ? "s" : ""} created
                  </div>
                </div>
              </td>
              <td className="text-right">
                <div className="flex items-center justify-end gap-2">
                  {!team.is_paid && !subscription?.bypass_subscription && (
                    <>
                      {/* If admin has included seats available, show Assign button */}
                      {(() => {
                        try {
                          const planKey = subscription?.plan_key;
                          const plan = subscription?.available_plans?.[planKey];
                          const limit = plan?.team_member_limit ?? 0;
                          const assignedCount = teams.filter(
                            (t) =>
                              t.user?.subscription &&
                              t.user.subscription.status === "active" &&
                              t.user.subscription.plan_key === planKey,
                          ).length;
                          const seatsAvailable = limit - assignedCount;

                          if (
                            seatsAvailable > 0 &&
                            team.user?.subscription?.status === "pending"
                          ) {
                            return (
                              <button
                                onClick={() => handleAssignIncludedSeat(team)}
                                className="mr-2 px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-emerald-700 transition-all shadow-md shadow-emerald-500/20"
                              >
                                Assign Seat
                              </button>
                            );
                          }
                        } catch (e) {
                          // silent
                        }
                        return (
                          <button
                            onClick={() => {
                              setSubscriptionTarget(team);
                              navigate(
                                `/pricing?member_user_id=${team.user_id}`,
                              );
                            }}
                            className="mr-2 px-3 py-1.5 bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-amber-600 transition-all shadow-md shadow-amber-500/20"
                          >
                            Subscribe Now
                          </button>
                        );
                      })()}
                    </>
                  )}
                  <button
                    onClick={() => handleEdit(team)}
                    className="p-2 hover:bg-blue-50 text-slate-300 hover:text-blue-600 rounded-xl transition-all"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(team.id)}
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
        title="Team Member"
        isEditing={!!editingId}
        onSubmit={handleSubmit}
        submitButtonText="Save Team Member"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">
              Full Name
            </label>
            <div className="relative group">
              <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-300 placeholder:font-medium"
                placeholder="e.g. John Doe"
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
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-300 placeholder:font-medium"
                placeholder="e.g. john@agency.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">
              Password {!editingId && <span className="text-red-500">*</span>}
            </label>
            <div className="relative group">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full px-4 pr-12 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-300 placeholder:font-medium"
                placeholder={
                  editingId
                    ? "Leave blank to keep current password"
                    : "Enter password"
                }
                required={!editingId}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">
              Confirm Password{" "}
              {!editingId && <span className="text-red-500">*</span>}
            </label>
            <div className="relative group">
              <input
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className="w-full px-4 pr-12 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-300 placeholder:font-medium"
                placeholder="Confirm password"
                required={!editingId}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-500 px-1">
            Password must be at least 8 characters and include uppercase,
            lowercase, number, and special character.
          </p>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <div className="phone-input-container">
              <PhoneInput
                defaultCountry="in"
                value={formData.phone}
                onChange={(phone) => setFormData({ ...formData, phone })}
                className="w-full"
                inputClassName="!w-full !px-4 !py-7 !bg-slate-50 !border-none !rounded-2xl !text-sm !font-bold !text-slate-900 !focus:ring-2 !focus:ring-blue-500/20 !transition-all !placeholder:text-slate-300 !placeholder:font-medium"
              />
            </div>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
};

export default Team;
