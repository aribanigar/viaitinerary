import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Plus,
  Search,
  FileText,
  Package,
  MapPin,
  Hotel,
  Car,
  Settings as SettingsIcon,
  Users,
  ShieldCheck,
  BarChart3,
  BookOpen,
  CreditCard,
  Type,
  Zap,
  Inbox,
  Wallet,
  KeyRound,
  Bell,
  ChevronsRight,
  ChevronsLeft,
  Aperture,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import InstallAppButton from "../common/InstallAppButton";

const INK = "#181c22";
const PIN_KEY = "nav_rail_pinned";

// Full navigation tree — the single source of truth for desktop nav, covering
// everything the old text sidebar exposed (Operations / Resources /
// Accounting / Settings), gated by the same roles.
const NAV_TREE = [
  { label: "Dashboard", icon: Home, to: "/dashboard" },
  {
    label: "Create a Trip",
    icon: Plus,
    to: "/trip-builder",
    roles: ["admin", "team"],
  },
  {
    label: "AI Assistant",
    icon: Search,
    to: "/assistant",
    roles: ["admin", "team"],
  },
  {
    label: "Operations",
    icon: FileText,
    roles: ["admin", "team"],
    children: [
      { label: "Trips", icon: FileText, to: "/my-trips" },
      { label: "Packages", icon: Package, to: "/packages" },
      {
        label: "Lead Inquiries",
        icon: Inbox,
        to: "/lead-inquiries",
        roles: ["admin", "team"],
      },
      { label: "Team", icon: Users, to: "/team", roles: ["admin"] },
      {
        label: "Team Reports",
        icon: BarChart3,
        to: "/team-report",
        roles: ["admin"],
      },
    ],
  },
  {
    label: "Resources",
    icon: MapPin,
    roles: ["admin", "team"],
    children: [
      { label: "Accommodation", icon: Hotel, to: "/accommodation" },
      { label: "Transportation", icon: Car, to: "/transportation" },
      { label: "Destinations", icon: MapPin, to: "/destinations" },
      {
        label: "Policies",
        icon: ShieldCheck,
        to: "/policies",
        roles: ["admin"],
      },
    ],
  },
  {
    label: "Accounting",
    icon: Wallet,
    roles: ["admin"],
    children: [
      { label: "Voucher Desk", icon: FileText, to: "/accounting" },
      { label: "Reports", icon: BarChart3, to: "/accounting-summary" },
      { label: "Ledger", icon: BookOpen, to: "/ledger" },
      { label: "Bank Details", icon: CreditCard, to: "/payment-details" },
      { label: "Subscription", icon: Zap, to: "/subscription" },
    ],
  },
  {
    label: "Settings",
    icon: SettingsIcon,
    roles: ["admin"],
    children: [
      { label: "General Settings", icon: SettingsIcon, to: "/settings" },
      { label: "Branding", icon: Type, to: "/typography" },
      { label: "Email Connect", icon: KeyRound, to: "/settings/email-connect" },
    ],
  },
];

const Mark = ({ className = "" }) => (
  <span
    className={`grid place-items-center rounded-full bg-[#181c22] ${className}`}
  >
    <Aperture className="w-[60%] h-[60%] text-white" strokeWidth={2.2} />
  </span>
);

function useRoleFilteredTree(role) {
  const has = (item) => !item.roles || item.roles.includes(role);
  return NAV_TREE.filter(has)
    .map((item) =>
      item.children
        ? { ...item, children: item.children.filter(has) }
        : item,
    )
    .filter((item) => !item.children || item.children.length > 0);
}

function Row({ icon: Icon, label, to, active, expanded, onNavigate }) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={`flex items-center h-11 rounded-2xl transition-colors whitespace-nowrap ${
        expanded ? "gap-3 px-[18px] w-full" : "w-11 mx-auto justify-center"
      } ${
        active
          ? "bg-[#181c22] text-white shadow-md"
          : "text-[#181c22]/55 hover:text-[#181c22] hover:bg-black/5"
      }`}
      title={expanded ? undefined : label}
    >
      <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={2} />
      {expanded && (
        <motion.span
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.16, delay: 0.04 }}
          className="text-[13px] font-semibold overflow-hidden text-ellipsis"
        >
          {label}
        </motion.span>
      )}
    </Link>
  );
}

function GroupHeader({ label }) {
  return (
    <div className="flex items-center h-7 px-[18px] mt-3 mb-0.5 text-[#181c22]/35">
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.16, delay: 0.04 }}
        className="text-[10px] font-black uppercase tracking-[0.14em] whitespace-nowrap"
      >
        {label}
      </motion.span>
    </div>
  );
}

/**
 * Shared desktop navigation rail: collapses to a clean 80px icon strip
 * (matching the Trip Builder / AI Assistant / Dashboard look) and smoothly
 * expands on hover — or when pinned open via the toggle — to show the full
 * labeled navigation tree, covering everything the legacy text sidebar did.
 * Mobile is unaffected; this only renders at the `lg` breakpoint up.
 */
const NavRail = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(
    () => localStorage.getItem(PIN_KEY) === "1",
  );

  useEffect(() => {
    localStorage.setItem(PIN_KEY, pinned ? "1" : "0");
  }, [pinned]);

  const expanded = hovered || pinned;
  const isActive = (p) => p && (pathname === p || pathname.startsWith(`${p}/`));
  const tree = useRoleFilteredTree(user?.role);

  const initials = (user?.name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <motion.aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      animate={{ width: expanded ? 272 : 80 }}
      transition={{ type: "spring", stiffness: 420, damping: 38 }}
      className="hidden lg:flex shrink-0 flex-col py-6 overflow-hidden"
    >
      <div
        className={`flex items-center gap-2 mb-8 ${expanded ? "px-5 justify-between" : "px-0 justify-center"}`}
      >
        <Link to="/dashboard" className="shrink-0">
          <Mark className="w-8 h-8" />
        </Link>
        {expanded && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setPinned((p) => !p)}
            title={pinned ? "Unpin sidebar" : "Pin sidebar open"}
            className="grid place-items-center w-8 h-8 rounded-full text-[#181c22]/40 hover:text-[#181c22] hover:bg-black/5 transition-colors"
          >
            {pinned ? (
              <ChevronsLeft className="w-4 h-4" />
            ) : (
              <ChevronsRight className="w-4 h-4" />
            )}
          </motion.button>
        )}
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2.5 py-2 space-y-0.5 no-scrollbar bg-white rounded-[26px] border border-black/5 shadow-sm mx-2">
        {tree.map((item) =>
          item.children ? (
            expanded ? (
              <div key={item.label}>
                <GroupHeader label={item.label} />
                {item.children.map((child) => (
                  <Row
                    key={child.to}
                    icon={child.icon}
                    label={child.label}
                    to={child.to}
                    active={isActive(child.to)}
                    expanded={expanded}
                  />
                ))}
              </div>
            ) : (
              <Row
                key={item.label}
                icon={item.icon}
                label={item.label}
                to={item.children[0].to}
                active={item.children.some((c) => isActive(c.to))}
                expanded={false}
              />
            )
          ) : (
            <Row
              key={item.to}
              icon={item.icon}
              label={item.label}
              to={item.to}
              active={isActive(item.to)}
              expanded={expanded}
            />
          ),
        )}
      </nav>

      <div className={`mt-4 px-2.5 space-y-2 ${expanded ? "" : "flex flex-col items-center"}`}>
        <InstallAppButton
          variant={expanded ? "pill" : "icon"}
          className={
            expanded
              ? "!w-full !justify-center !bg-white !text-[#181c22] !border !border-black/10 hover:!bg-black/5"
              : "!w-11 !h-11 !rounded-2xl hover:!text-[#181c22]"
          }
        />
        <Link
          to="/notifications"
          className={`relative flex items-center gap-3 h-11 rounded-2xl bg-white border border-black/5 text-[#181c22]/60 shadow-sm hover:text-[#181c22] transition-colors ${expanded ? "px-[18px]" : "justify-center"}`}
        >
          <Bell className="w-[18px] h-[18px] shrink-0" strokeWidth={2} />
          {expanded && (
            <span className="text-[13px] font-semibold">Notifications</span>
          )}
          <span
            className={`absolute w-2 h-2 rounded-full bg-[#ff5a4d] ring-2 ring-white ${expanded ? "top-3 left-8" : "top-2.5 right-2.5"}`}
          />
        </Link>
        <button
          onClick={() => navigate("/profile")}
          className={`w-full flex items-center gap-3 rounded-2xl transition-colors hover:bg-black/5 ${expanded ? "p-2" : "justify-center py-1"}`}
        >
          <div className="w-9 h-9 shrink-0 rounded-2xl bg-[#e7f63c] text-[#181c22] grid place-items-center font-bold text-xs border border-black/5 shadow-sm">
            {initials}
          </div>
          {expanded && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.16, delay: 0.04 }}
              className="min-w-0 text-left"
            >
              <p className="text-[12px] font-bold text-[#181c22] truncate leading-tight">
                {user?.name || "User"}
              </p>
              <p className="text-[10px] text-[#9aa3b2] truncate leading-tight">
                {user?.email || "Admin"}
              </p>
            </motion.div>
          )}
        </button>
      </div>
    </motion.aside>
  );
};

export default NavRail;
