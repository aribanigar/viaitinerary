import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home,
  Calendar,
  Search,
  Users,
  Settings,
  Bell,
  Sparkles,
  Aperture,
  Menu,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import InstallAppButton from "../common/InstallAppButton";
import NavRail from "./NavRail";
import Sidebar from "./Sidebar";

const INK = "#181c22";

// Black aperture brand mark (same as the AI-assistant page).
const Mark = ({ className = "" }) => (
  <span
    className={`grid place-items-center rounded-full bg-[#181c22] ${className}`}
  >
    <Aperture className="w-[60%] h-[60%] text-white" strokeWidth={2.2} />
  </span>
);

const NAV_ITEMS = [
  { icon: Home, to: "/dashboard", label: "Home", match: ["/dashboard"] },
  {
    icon: Calendar,
    to: "/my-trips",
    label: "Trips",
    match: ["/my-trips", "/trip-builder", "/package-builder", "/packages"],
  },
  { icon: Search, to: "/assistant", label: "Assistant", match: ["/assistant"] },
  { icon: Users, to: "/team", label: "Team", match: ["/team"] },
  { icon: Settings, to: "/settings", label: "Settings", match: ["/settings"] },
];

// Bottom app-style tab bar shown on phones/tablets in place of the desktop
// icon rail — always visible, thumb-reachable, and safe-area aware.
const BottomTabBar = ({ is }) => (
  <nav
    className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-black/5 pb-[env(safe-area-inset-bottom)]"
    aria-label="Primary"
  >
    <div className="grid grid-cols-5">
      {NAV_ITEMS.map(({ icon: Icon, to, label, match }) => {
        const active = match.some((m) => is(m));
        return (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center justify-center gap-1 py-2.5 min-h-[52px] active:bg-black/5 transition-colors"
          >
            <Icon
              className={`w-5 h-5 ${active ? "text-[#181c22]" : "text-[#181c22]/40"}`}
              strokeWidth={active ? 2.4 : 2}
            />
            <span
              className={`text-[10px] font-medium leading-none ${active ? "text-[#181c22]" : "text-[#181c22]/40"}`}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </div>
  </nav>
);

// Slim top bar shown on phones/tablets: hamburger (full nav drawer) + brand
// mark on the left, notifications + profile on the right, standing in for
// the rail's bottom cluster on desktop.
const MobileTopBar = ({ initials, onMenuClick }) => (
  <header className="lg:hidden flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+10px)] pb-2.5 shrink-0">
    <div className="flex items-center gap-2.5">
      <button
        onClick={onMenuClick}
        className="grid place-items-center w-9 h-9 rounded-full bg-white border border-black/5 text-[#181c22]/70 shadow-sm active:bg-black/5"
        aria-label="Open menu"
      >
        <Menu className="w-[18px] h-[18px]" strokeWidth={2} />
      </button>
      <Link to="/dashboard" className="flex items-center gap-2">
        <Mark className="w-7 h-7" />
      </Link>
    </div>
    <div className="flex items-center gap-2">
      <InstallAppButton variant="icon" />
      <Link
        to="/notifications"
        className="relative grid place-items-center w-9 h-9 rounded-full bg-white border border-black/5 text-[#181c22]/60 shadow-sm active:bg-black/5"
      >
        <Bell className="w-[16px] h-[16px]" strokeWidth={2} />
        <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#ff5a4d] ring-2 ring-white" />
      </Link>
      <div className="w-9 h-9 rounded-full bg-[#e7f63c] text-[#181c22] grid place-items-center font-bold text-xs border border-black/5 shadow-sm">
        {initials}
      </div>
    </div>
  </header>
);

// Shared full-screen frame that mirrors the AI-assistant page: a slim floating
// icon rail on the left + a rounded content surface with a minimal top bar on
// large screens; a bottom tab bar + full-bleed content on phones/tablets.
// Pass `title` (shown with a lime sparkle), `nav`/`actions` (header slots),
// and the two-panel body as `children`.
const AssistantFrame = ({ title, nav, actions, children }) => {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const is = (p) => pathname.startsWith(p);
  const initials = (user?.name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="h-[100dvh] w-full bg-[#f0f0f1] text-[#181c22] font-sans antialiased flex overflow-hidden">
      {/* Mobile: hamburger opens the same full-featured drawer the rest of the
          app uses. Desktop: collapses to icons, expands on hover/pin. */}
      <Sidebar
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />
      <NavRail />

      {/* Content surface: full-bleed on mobile, rounded floating panel on desktop */}
      <main className="flex-1 flex flex-col min-w-0 lg:my-4 lg:mr-4 lg:rounded-[28px] bg-[#fbfbfb] lg:border lg:border-black/5 lg:shadow-[0_20px_60px_-30px_rgba(16,24,42,0.35)] overflow-hidden">
        <MobileTopBar
          initials={initials}
          onMenuClick={() => setMobileNavOpen(true)}
        />
        <header className="flex flex-wrap items-center gap-3 lg:gap-6 px-4 lg:px-8 pt-1 lg:pt-5 pb-3 lg:pb-4 border-b border-black/5 shrink-0">
          <div className="flex items-center gap-2 pr-2 min-w-0">
            <Sparkles
              className="w-4 h-4 shrink-0 hidden lg:block"
              style={{ color: "#e7f63c" }}
              fill="#e7f63c"
            />
            {typeof title === "string" ? (
              <span className="text-[15px] font-semibold tracking-tight">
                {title}
              </span>
            ) : (
              title
            )}
          </div>
          {nav && (
            <div className="flex items-center gap-4 lg:gap-6 lg:border-l lg:border-black/10 lg:pl-6">
              {nav}
            </div>
          )}
          {actions && (
            <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
              {actions}
            </div>
          )}
        </header>
        <div className="flex-1 min-h-0 overflow-hidden pb-[calc(env(safe-area-inset-bottom)+56px)] lg:pb-0">
          {children}
        </div>
      </main>
      <BottomTabBar is={is} />
    </div>
  );
};

export default AssistantFrame;
