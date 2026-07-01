import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Plus,
  FileText,
  Package,
  MapPin,
  Hotel,
  Car,
  Settings as SettingsIcon,
  Users,
  Building,
  ShieldCheck,
  BarChart3,
  BookOpen,
  CalendarCheck,
  Calculator,
  CreditCard,
  Type,
  Zap,
  Image as ImageIcon,
  Inbox,
  Code,
  ChevronDown,
  ChevronRight,
  PenTool,
  Tag,
  Wallet,
  KeyRound,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import logoDark from "../../assets/logo-dark.png";

const Sidebar = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const location = useLocation();
  const [isBlogSubmenuOpen, setIsBlogSubmenuOpen] = useState(
    location.pathname.startsWith("/blog"),
  );

  const [isOperationsSubmenuOpen, setIsOperationsSubmenuOpen] = useState(
    location.pathname.startsWith("/my-trips") ||
      location.pathname.startsWith("/lead-inquiries") ||
      location.pathname.startsWith("/integrations") ||
      location.pathname.startsWith("/team") ||
      location.pathname.startsWith("/team-report"),
  );

  const [isResourcesSubmenuOpen, setIsResourcesSubmenuOpen] = useState(
    location.pathname.startsWith("/accommodation") ||
      location.pathname.startsWith("/transportation") ||
      location.pathname.startsWith("/destinations") ||
      location.pathname.startsWith("/policies"),
  );

  const [isAccountingSubmenuOpen, setIsAccountingSubmenuOpen] = useState(
    location.pathname.startsWith("/accounting") ||
      location.pathname.startsWith("/ledger") ||
      location.pathname.startsWith("/payment-details") ||
      location.pathname.startsWith("/subscription"),
  );

  const [isSettingsSubmenuOpen, setIsSettingsSubmenuOpen] = useState(
    location.pathname.startsWith("/settings") ||
      location.pathname.startsWith("/typography"),
  );

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  const getInitials = (pathName) => {
    if (!pathName) return "US";
    return pathName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 lg:hidden transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 w-72 bg-[#1b1b1b] text-slate-400 flex flex-col shrink-0 h-screen z-50 transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Link to="/" onClick={onClose} className="px-6 flex items-center group">
          <img
            src={logoDark}
            alt="ViaItinerary"
            className="h-26 w-auto object-contain block"
          />
        </Link>

        <nav className="flex-1 px-4 py-2 space-y-0.5 overflow-y-auto custom-sidebar-scrollbar">
          <Link
            to="/dashboard"
            onClick={onClose}
            className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
              isActive("/dashboard")
                ? "bg-white text-[#1b1b1b] shadow-lg shadow-black/20 font-semibold"
                : "hover:bg-white/5 hover:text-white font-medium text-slate-400"
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Dashboard</span>
          </Link>

          {user?.role === "super_admin" && (
            <>
              <div className="pt-2 pb-1">
                <span className="px-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Management
                </span>
              </div>

              <Link
                to="/businesses"
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                  isActive("/businesses")
                    ? "bg-white text-[#1b1b1b] shadow-lg shadow-black/20 font-semibold"
                    : "hover:bg-white/5 hover:text-white font-medium text-slate-400"
                }`}
              >
                <Building className="w-5 h-5" />
                <span>Businesses</span>
              </Link>

              <Link
                to="/public-leads"
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                  isActive("/public-leads")
                    ? "bg-white text-[#1b1b1b] shadow-lg shadow-black/20 font-semibold"
                    : "hover:bg-white/5 hover:text-white font-medium text-slate-400"
                }`}
              >
                <Inbox className="w-5 h-5" />
                <span>Public Leads</span>
              </Link>

              <Link
                to="/demo-requests"
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                  isActive("/demo-requests")
                    ? "bg-white text-[#1b1b1b] shadow-lg shadow-black/20 font-semibold"
                    : "hover:bg-white/5 hover:text-white font-medium text-slate-400"
                }`}
              >
                <CalendarCheck className="w-5 h-5" />
                <span>Demo Requests</span>
              </Link>

              <Link
                to="/admin/showcase"
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                  isActive("/admin/showcase")
                    ? "bg-white text-[#1b1b1b] shadow-lg shadow-black/20 font-semibold"
                    : "hover:bg-white/5 hover:text-white font-medium text-slate-400"
                }`}
              >
                <ImageIcon className="w-5 h-5" />
                <span>Showcase</span>
              </Link>

              <Link
                to="/admin/trusted-companies"
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                  isActive("/admin/trusted-companies")
                    ? "bg-white text-[#1b1b1b] shadow-lg shadow-black/20 font-semibold"
                    : "hover:bg-white/5 hover:text-white font-medium text-slate-400"
                }`}
              >
                <ShieldCheck className="w-5 h-5" />
                <span>Trusted By</span>
              </Link>

              {/* Super Admin Blog Management */}
              <div className="space-y-0.5">
                <button
                  onClick={() => setIsBlogSubmenuOpen(!isBlogSubmenuOpen)}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                    location.pathname.startsWith("/admin/blog")
                      ? "bg-white/5 text-white font-bold"
                      : "hover:bg-white/5 hover:text-white font-medium text-slate-400"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <PenTool className="w-5 h-5" />
                    <span>Blog</span>
                  </div>
                  {isBlogSubmenuOpen ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>

                {isBlogSubmenuOpen && (
                  <div className="ml-4 pl-4 border-l border-slate-800 space-y-0.5 mt-1 transition-all duration-300">
                    <Link
                      to="/admin/blog/posts"
                      onClick={onClose}
                      className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                        isActive("/admin/blog/posts")
                          ? "bg-white text-[#1b1b1b] shadow-lg shadow-black/20 font-semibold"
                          : "hover:bg-white/5 hover:text-white font-medium text-slate-400"
                      }`}
                    >
                      <FileText className="w-5 h-5" />
                      <span>Posts</span>
                    </Link>
                    <Link
                      to="/admin/blog/categories"
                      onClick={onClose}
                      className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                        isActive("/admin/blog/categories")
                          ? "bg-white text-[#1b1b1b] shadow-lg shadow-black/20 font-semibold"
                          : "hover:bg-white/5 hover:text-white font-medium text-slate-400"
                      }`}
                    >
                      <Tag className="w-5 h-5" />
                      <span>Categories</span>
                    </Link>
                  </div>
                )}
              </div>

              <Link
                to="/admin/plans"
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                  isActive("/admin/plans")
                    ? "bg-white text-[#1b1b1b] shadow-lg shadow-black/20 font-semibold"
                    : "hover:bg-white/5 hover:text-white font-medium text-slate-400"
                }`}
              >
                <Zap className="w-5 h-5" />
                <span>Subscription Plans</span>
              </Link>
            </>
          )}

          {(user?.role === "admin" || user?.role === "team") && (
            <>
              <Link
                to="/trip-builder"
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                  isActive("/trip-builder")
                    ? "bg-white text-[#1b1b1b] shadow-lg shadow-black/20 font-semibold"
                    : "hover:bg-white/5 hover:text-white font-medium text-slate-400"
                }`}
              >
                <Plus className="w-5 h-5" />
                <span>Create a trip</span>
              </Link>

              <div className="space-y-0.5 mt-1">
                <button
                  onClick={() =>
                    setIsOperationsSubmenuOpen(!isOperationsSubmenuOpen)
                  }
                  className={`w-full flex items-center justify-between gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                    isActive("/my-trips") ||
                    isActive("/lead-inquiries") ||
                    isActive("/integrations") ||
                    isActive("/team") ||
                    isActive("/team-report")
                      ? "bg-white/5 text-white font-bold"
                      : "hover:bg-white/5 hover:text-white font-medium text-slate-400"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5" />
                    <span>Operations</span>
                  </div>
                  {isOperationsSubmenuOpen ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>

                {isOperationsSubmenuOpen && (
                  <div className="ml-4 pl-4 border-l border-slate-800 space-y-0.5 mt-1 transition-all duration-300">
                    <Link
                      to="/my-trips"
                      onClick={onClose}
                      className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                        isActive("/my-trips")
                          ? "bg-white text-[#1b1b1b] shadow-lg shadow-black/20 font-semibold"
                          : "hover:bg-white/5 hover:text-white font-medium text-slate-400"
                      }`}
                    >
                      <FileText className="w-5 h-5" />
                      <span>Trips</span>
                    </Link>

                    <Link
                      to="/packages"
                      onClick={onClose}
                      className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                        isActive("/packages") || isActive("/package-builder")
                          ? "bg-white text-[#1b1b1b] shadow-lg shadow-black/20 font-semibold"
                          : "hover:bg-white/5 hover:text-white font-medium text-slate-400"
                      }`}
                    >
                      <Package className="w-5 h-5" />
                      <span>Packages</span>
                    </Link>

                    {(user?.role === "admin" || user?.role === "team") && (
                      <Link
                        to="/lead-inquiries"
                        onClick={onClose}
                        className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                          isActive("/lead-inquiries") ||
                          isActive("/integrations")
                            ? "bg-white text-[#1b1b1b] shadow-lg shadow-black/20 font-semibold"
                            : "hover:bg-white/5 hover:text-white font-medium text-slate-400"
                        }`}
                      >
                        <Inbox className="w-5 h-5" />
                        <span>Lead Inquiries</span>
                      </Link>
                    )}

                    {user?.role === "admin" && (
                      <Link
                        to="/team"
                        onClick={onClose}
                        className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                          isActive("/team")
                            ? "bg-white text-[#1b1b1b] shadow-lg shadow-black/20 font-semibold"
                            : "hover:bg-white/5 hover:text-white font-medium text-slate-400"
                        }`}
                      >
                        <Users className="w-5 h-5" />
                        <span>Team</span>
                      </Link>
                    )}

                    {user?.role === "admin" && (
                      <Link
                        to="/team-report"
                        onClick={onClose}
                        className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                          isActive("/team-report")
                            ? "bg-white text-[#1b1b1b] shadow-lg shadow-black/20 font-semibold"
                            : "hover:bg-white/5 hover:text-white font-medium text-slate-400"
                        }`}
                      >
                        <BarChart3 className="w-5 h-5" />
                        <span>Team Reports</span>
                      </Link>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-0.5 mt-1">
                <button
                  onClick={() =>
                    setIsResourcesSubmenuOpen(!isResourcesSubmenuOpen)
                  }
                  className={`w-full flex items-center justify-between gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                    isActive("/accommodation") ||
                    isActive("/transportation") ||
                    isActive("/destinations") ||
                    isActive("/policies")
                      ? "bg-white/5 text-white font-bold"
                      : "hover:bg-white/5 hover:text-white font-medium text-slate-400"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5" />
                    <span>Resources</span>
                  </div>
                  {isResourcesSubmenuOpen ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>

                {isResourcesSubmenuOpen && (
                  <div className="ml-4 pl-4 border-l border-slate-800 space-y-0.5 mt-1 transition-all duration-300">
                    <Link
                      to="/accommodation"
                      onClick={onClose}
                      className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                        isActive("/accommodation")
                          ? "bg-white text-[#1b1b1b] shadow-lg shadow-black/20 font-semibold"
                          : "hover:bg-white/5 hover:text-white font-medium text-slate-400"
                      }`}
                    >
                      <Hotel className="w-5 h-5" />
                      <span>Accomodation</span>
                    </Link>

                    <Link
                      to="/transportation"
                      onClick={onClose}
                      className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                        isActive("/transportation")
                          ? "bg-white text-[#1b1b1b] shadow-lg shadow-black/20 font-semibold"
                          : "hover:bg-white/5 hover:text-white font-medium text-slate-400"
                      }`}
                    >
                      <Car className="w-5 h-5" />
                      <span>Transportation</span>
                    </Link>

                    <Link
                      to="/destinations"
                      onClick={onClose}
                      className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                        isActive("/destinations")
                          ? "bg-white text-[#1b1b1b] shadow-lg shadow-black/20 font-semibold"
                          : "hover:bg-white/5 hover:text-white font-medium text-slate-400"
                      }`}
                    >
                      <MapPin className="w-5 h-5" />
                      <span>Destination</span>
                    </Link>

                    {user?.role === "admin" && (
                      <Link
                        to="/policies"
                        onClick={onClose}
                        className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                          isActive("/policies")
                            ? "bg-white text-[#1b1b1b] shadow-lg shadow-black/20 font-semibold"
                            : "hover:bg-white/5 hover:text-white font-medium text-slate-400"
                        }`}
                      >
                        <ShieldCheck className="w-5 h-5" />
                        <span>Policies</span>
                      </Link>
                    )}
                  </div>
                )}
              </div>

              {user?.role === "admin" && (
                <div className="space-y-0.5 mt-1">
                  <button
                    onClick={() =>
                      setIsAccountingSubmenuOpen(!isAccountingSubmenuOpen)
                    }
                    className={`w-full flex items-center justify-between gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                      isActive("/accounting") ||
                      isActive("/ledger") ||
                      isActive("/payment-details") ||
                      isActive("/subscription")
                        ? "bg-white/5 text-white font-bold"
                        : "hover:bg-white/5 hover:text-white font-medium text-slate-400"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Wallet className="w-5 h-5" />
                      <span>Accounting</span>
                    </div>
                    {isAccountingSubmenuOpen ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>

                  {isAccountingSubmenuOpen && (
                    <div className="ml-4 pl-4 border-l border-slate-800 space-y-0.5 mt-1 transition-all duration-300">
                      <Link
                        to="/accounting"
                        onClick={onClose}
                        className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                          isActive("/accounting")
                            ? "bg-white text-[#1b1b1b] shadow-lg shadow-black/20 font-semibold"
                            : "hover:bg-white/5 hover:text-white font-medium text-slate-400"
                        }`}
                      >
                        <FileText className="w-5 h-5" />
                        <span>Voucher Desk</span>
                      </Link>

                      <Link
                        to="/accounting-summary"
                        onClick={onClose}
                        className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                          isActive("/accounting-summary")
                            ? "bg-white text-[#1b1b1b] shadow-lg shadow-black/20 font-semibold"
                            : "hover:bg-white/5 hover:text-white font-medium text-slate-400"
                        }`}
                      >
                        <BarChart3 className="w-5 h-5" />
                        <span>Reports</span>
                      </Link>

                      <Link
                        to="/ledger"
                        onClick={onClose}
                        className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                          isActive("/ledger")
                            ? "bg-white text-[#1b1b1b] shadow-lg shadow-black/20 font-semibold"
                            : "hover:bg-white/5 hover:text-white font-medium text-slate-400"
                        }`}
                      >
                        <BookOpen className="w-5 h-5" />
                        <span>Ledger</span>
                      </Link>

                      <Link
                        to="/payment-details"
                        onClick={onClose}
                        className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                          isActive("/payment-details")
                            ? "bg-white text-[#1b1b1b] shadow-lg shadow-black/20 font-semibold"
                            : "hover:bg-white/5 hover:text-white font-medium text-slate-400"
                        }`}
                      >
                        <CreditCard className="w-5 h-5" />
                        <span>Bank details</span>
                      </Link>

                      <Link
                        to="/subscription"
                        onClick={onClose}
                        className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                          isActive("/subscription")
                            ? "bg-white text-[#1b1b1b] shadow-lg shadow-black/20 font-semibold"
                            : "hover:bg-white/5 hover:text-white font-medium text-slate-400"
                        }`}
                      >
                        <Zap className="w-5 h-5" />
                        <span>Subscription</span>
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {user?.role === "admin" && (
                <div className="space-y-0.5 mt-1">
                  <button
                    onClick={() =>
                      setIsSettingsSubmenuOpen(!isSettingsSubmenuOpen)
                    }
                    className={`w-full flex items-center justify-between gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                      isActive("/settings") || isActive("/typography")
                        ? "bg-white/5 text-white font-bold"
                        : "hover:bg-white/5 hover:text-white font-medium text-slate-400"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <SettingsIcon className="w-5 h-5" />
                      <span>Settings</span>
                    </div>
                    {isSettingsSubmenuOpen ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>

                  {isSettingsSubmenuOpen && (
                    <div className="ml-4 pl-4 border-l border-slate-800 space-y-0.5 mt-1 transition-all duration-300">
                      <Link
                        to="/settings"
                        onClick={onClose}
                        className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                          location.pathname === "/settings"
                            ? "bg-white text-[#1b1b1b] shadow-lg shadow-black/20 font-semibold"
                            : "hover:bg-white/5 hover:text-white font-medium text-slate-400"
                        }`}
                      >
                        <SettingsIcon className="w-5 h-5" />
                        <span>General Settings</span>
                      </Link>

                      <Link
                        to="/typography"
                        onClick={onClose}
                        className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                          isActive("/typography")
                            ? "bg-white text-[#1b1b1b] shadow-lg shadow-black/20 font-semibold"
                            : "hover:bg-white/5 hover:text-white font-medium text-slate-400"
                        }`}
                      >
                        <Type className="w-5 h-5" />
                        <span>Typography</span>
                      </Link>

                      <Link
                        to="/settings/email-connect"
                        onClick={onClose}
                        className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                          isActive("/settings/email-connect")
                            ? "bg-white text-[#1b1b1b] shadow-lg shadow-black/20 font-semibold"
                            : "hover:bg-white/5 hover:text-white font-medium text-slate-400"
                        }`}
                      >
                        <KeyRound className="w-5 h-5" />
                        <span>Email Connect</span>
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </nav>

        <div className="p-4 mt-auto">
          <Link
            to="/profile"
            onClick={onClose}
            className="bg-white/5 rounded-2xl p-4 flex items-center gap-3 border border-white/5 hover:bg-white/10 transition-colors cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xs ring-4 ring-white/5 shadow-inner shrink-0 overflow-hidden">
              {user?.profile_picture ? (
                <img
                  src={`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/storage/${user.profile_picture}`}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                getInitials(user?.name)
              )}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-white leading-none truncate">
                {user?.name || "User"}
              </p>
              <p className="text-[10px] text-slate-500 mt-1 font-medium truncate">
                {user?.email || "Admin"}
              </p>
            </div>
          </Link>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
