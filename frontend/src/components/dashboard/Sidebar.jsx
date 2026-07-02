import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Plus,
  Sparkles,
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
import logoLight from "../../assets/logo-light.png";

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
        className={`fixed inset-y-0 left-0 w-72 bg-white text-[#5b6472] flex flex-col shrink-0 h-screen z-50 transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:h-[calc(100vh-24px)] lg:my-3 lg:ml-3 lg:rounded-[24px] lg:border lg:border-black/5 lg:shadow-[0_18px_50px_-28px_rgba(16,24,42,0.35)] ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Link to="/" onClick={onClose} className="px-6 flex items-center group">
          <img
            src={logoLight}
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
                ? "bg-[#c7f135] text-[#10182a] shadow-lg shadow-[#c7f135]/30 font-semibold"
                : "hover:bg-black/[0.04] hover:text-[#10182a] font-medium text-[#5b6472]"
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Dashboard</span>
          </Link>

          {user?.role === "super_admin" && (
            <>
              <div className="pt-2 pb-1">
                <span className="px-4 text-[10px] font-black uppercase tracking-widest text-[#9aa3b2]">
                  Management
                </span>
              </div>

              <Link
                to="/businesses"
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                  isActive("/businesses")
                    ? "bg-[#c7f135] text-[#10182a] shadow-lg shadow-[#c7f135]/30 font-semibold"
                    : "hover:bg-black/[0.04] hover:text-[#10182a] font-medium text-[#5b6472]"
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
                    ? "bg-[#c7f135] text-[#10182a] shadow-lg shadow-[#c7f135]/30 font-semibold"
                    : "hover:bg-black/[0.04] hover:text-[#10182a] font-medium text-[#5b6472]"
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
                    ? "bg-[#c7f135] text-[#10182a] shadow-lg shadow-[#c7f135]/30 font-semibold"
                    : "hover:bg-black/[0.04] hover:text-[#10182a] font-medium text-[#5b6472]"
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
                    ? "bg-[#c7f135] text-[#10182a] shadow-lg shadow-[#c7f135]/30 font-semibold"
                    : "hover:bg-black/[0.04] hover:text-[#10182a] font-medium text-[#5b6472]"
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
                    ? "bg-[#c7f135] text-[#10182a] shadow-lg shadow-[#c7f135]/30 font-semibold"
                    : "hover:bg-black/[0.04] hover:text-[#10182a] font-medium text-[#5b6472]"
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
                      ? "bg-black/[0.03] text-[#10182a] font-bold"
                      : "hover:bg-black/[0.04] hover:text-[#10182a] font-medium text-[#5b6472]"
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
                  <div className="ml-4 pl-4 border-l border-black/5 space-y-0.5 mt-1 transition-all duration-300">
                    <Link
                      to="/admin/blog/posts"
                      onClick={onClose}
                      className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                        isActive("/admin/blog/posts")
                          ? "bg-[#c7f135] text-[#10182a] shadow-lg shadow-[#c7f135]/30 font-semibold"
                          : "hover:bg-black/[0.04] hover:text-[#10182a] font-medium text-[#5b6472]"
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
                          ? "bg-[#c7f135] text-[#10182a] shadow-lg shadow-[#c7f135]/30 font-semibold"
                          : "hover:bg-black/[0.04] hover:text-[#10182a] font-medium text-[#5b6472]"
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
                    ? "bg-[#c7f135] text-[#10182a] shadow-lg shadow-[#c7f135]/30 font-semibold"
                    : "hover:bg-black/[0.04] hover:text-[#10182a] font-medium text-[#5b6472]"
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
                    ? "bg-[#c7f135] text-[#10182a] shadow-lg shadow-[#c7f135]/30 font-semibold"
                    : "hover:bg-black/[0.04] hover:text-[#10182a] font-medium text-[#5b6472]"
                }`}
              >
                <Plus className="w-5 h-5" />
                <span>Create a trip</span>
              </Link>

              <Link
                to="/assistant"
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                  isActive("/assistant")
                    ? "bg-[#c7f135] text-[#10182a] shadow-lg shadow-[#c7f135]/30 font-semibold"
                    : "hover:bg-black/[0.04] hover:text-[#10182a] font-medium text-[#5b6472]"
                }`}
              >
                <Sparkles className="w-5 h-5" />
                <span>AI Assistant</span>
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
                      ? "bg-black/[0.03] text-[#10182a] font-bold"
                      : "hover:bg-black/[0.04] hover:text-[#10182a] font-medium text-[#5b6472]"
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
                  <div className="ml-4 pl-4 border-l border-black/5 space-y-0.5 mt-1 transition-all duration-300">
                    <Link
                      to="/my-trips"
                      onClick={onClose}
                      className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                        isActive("/my-trips")
                          ? "bg-[#c7f135] text-[#10182a] shadow-lg shadow-[#c7f135]/30 font-semibold"
                          : "hover:bg-black/[0.04] hover:text-[#10182a] font-medium text-[#5b6472]"
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
                          ? "bg-[#c7f135] text-[#10182a] shadow-lg shadow-[#c7f135]/30 font-semibold"
                          : "hover:bg-black/[0.04] hover:text-[#10182a] font-medium text-[#5b6472]"
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
                            ? "bg-[#c7f135] text-[#10182a] shadow-lg shadow-[#c7f135]/30 font-semibold"
                            : "hover:bg-black/[0.04] hover:text-[#10182a] font-medium text-[#5b6472]"
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
                            ? "bg-[#c7f135] text-[#10182a] shadow-lg shadow-[#c7f135]/30 font-semibold"
                            : "hover:bg-black/[0.04] hover:text-[#10182a] font-medium text-[#5b6472]"
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
                            ? "bg-[#c7f135] text-[#10182a] shadow-lg shadow-[#c7f135]/30 font-semibold"
                            : "hover:bg-black/[0.04] hover:text-[#10182a] font-medium text-[#5b6472]"
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
                      ? "bg-black/[0.03] text-[#10182a] font-bold"
                      : "hover:bg-black/[0.04] hover:text-[#10182a] font-medium text-[#5b6472]"
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
                  <div className="ml-4 pl-4 border-l border-black/5 space-y-0.5 mt-1 transition-all duration-300">
                    <Link
                      to="/accommodation"
                      onClick={onClose}
                      className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                        isActive("/accommodation")
                          ? "bg-[#c7f135] text-[#10182a] shadow-lg shadow-[#c7f135]/30 font-semibold"
                          : "hover:bg-black/[0.04] hover:text-[#10182a] font-medium text-[#5b6472]"
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
                          ? "bg-[#c7f135] text-[#10182a] shadow-lg shadow-[#c7f135]/30 font-semibold"
                          : "hover:bg-black/[0.04] hover:text-[#10182a] font-medium text-[#5b6472]"
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
                          ? "bg-[#c7f135] text-[#10182a] shadow-lg shadow-[#c7f135]/30 font-semibold"
                          : "hover:bg-black/[0.04] hover:text-[#10182a] font-medium text-[#5b6472]"
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
                            ? "bg-[#c7f135] text-[#10182a] shadow-lg shadow-[#c7f135]/30 font-semibold"
                            : "hover:bg-black/[0.04] hover:text-[#10182a] font-medium text-[#5b6472]"
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
                        ? "bg-black/[0.03] text-[#10182a] font-bold"
                        : "hover:bg-black/[0.04] hover:text-[#10182a] font-medium text-[#5b6472]"
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
                    <div className="ml-4 pl-4 border-l border-black/5 space-y-0.5 mt-1 transition-all duration-300">
                      <Link
                        to="/accounting"
                        onClick={onClose}
                        className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                          isActive("/accounting")
                            ? "bg-[#c7f135] text-[#10182a] shadow-lg shadow-[#c7f135]/30 font-semibold"
                            : "hover:bg-black/[0.04] hover:text-[#10182a] font-medium text-[#5b6472]"
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
                            ? "bg-[#c7f135] text-[#10182a] shadow-lg shadow-[#c7f135]/30 font-semibold"
                            : "hover:bg-black/[0.04] hover:text-[#10182a] font-medium text-[#5b6472]"
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
                            ? "bg-[#c7f135] text-[#10182a] shadow-lg shadow-[#c7f135]/30 font-semibold"
                            : "hover:bg-black/[0.04] hover:text-[#10182a] font-medium text-[#5b6472]"
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
                            ? "bg-[#c7f135] text-[#10182a] shadow-lg shadow-[#c7f135]/30 font-semibold"
                            : "hover:bg-black/[0.04] hover:text-[#10182a] font-medium text-[#5b6472]"
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
                            ? "bg-[#c7f135] text-[#10182a] shadow-lg shadow-[#c7f135]/30 font-semibold"
                            : "hover:bg-black/[0.04] hover:text-[#10182a] font-medium text-[#5b6472]"
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
                        ? "bg-black/[0.03] text-[#10182a] font-bold"
                        : "hover:bg-black/[0.04] hover:text-[#10182a] font-medium text-[#5b6472]"
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
                    <div className="ml-4 pl-4 border-l border-black/5 space-y-0.5 mt-1 transition-all duration-300">
                      <Link
                        to="/settings"
                        onClick={onClose}
                        className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                          location.pathname === "/settings"
                            ? "bg-[#c7f135] text-[#10182a] shadow-lg shadow-[#c7f135]/30 font-semibold"
                            : "hover:bg-black/[0.04] hover:text-[#10182a] font-medium text-[#5b6472]"
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
                            ? "bg-[#c7f135] text-[#10182a] shadow-lg shadow-[#c7f135]/30 font-semibold"
                            : "hover:bg-black/[0.04] hover:text-[#10182a] font-medium text-[#5b6472]"
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
                            ? "bg-[#c7f135] text-[#10182a] shadow-lg shadow-[#c7f135]/30 font-semibold"
                            : "hover:bg-black/[0.04] hover:text-[#10182a] font-medium text-[#5b6472]"
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
            className="bg-black/[0.03] rounded-2xl p-4 flex items-center gap-3 border border-black/5 hover:bg-black/[0.06] transition-colors cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-[#c7f135] flex items-center justify-center text-[#10182a] font-bold text-xs ring-4 ring-black/5 shadow-inner shrink-0 overflow-hidden">
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
              <p className="text-sm font-bold text-[#10182a] leading-none truncate">
                {user?.name || "User"}
              </p>
              <p className="text-[10px] text-[#9aa3b2] mt-1 font-medium truncate">
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
