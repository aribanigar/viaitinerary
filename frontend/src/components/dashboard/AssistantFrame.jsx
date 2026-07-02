import React from "react";
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
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const INK = "#10182a";

// Black aperture brand mark (same as the AI-assistant page).
const Mark = ({ className = "" }) => (
  <span
    className={`grid place-items-center rounded-full bg-[#10182a] ${className}`}
  >
    <Aperture className="w-[60%] h-[60%] text-white" strokeWidth={2.2} />
  </span>
);

const RailIcon = ({ icon: Icon, active, to }) => {
  const cls = `grid place-items-center w-11 h-11 rounded-2xl transition-colors ${
    active
      ? "bg-[#10182a] text-white shadow-md"
      : "text-[#10182a]/50 hover:text-[#10182a] hover:bg-black/5"
  }`;
  return (
    <Link to={to} className={cls}>
      <Icon className="w-[18px] h-[18px]" strokeWidth={2} />
    </Link>
  );
};

// Shared full-screen frame that mirrors the AI-assistant page: a slim floating
// icon rail on the left + a rounded content surface with a minimal top bar.
// Pass `title` (shown with a lime sparkle), `actions` (right side of the bar),
// and the two-panel body as `children`.
const AssistantFrame = ({ title, nav, actions, children }) => {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const is = (p) => pathname.startsWith(p);
  const initials = (user?.name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="h-screen w-full bg-[#f0f0f1] text-[#10182a] font-sans antialiased flex overflow-hidden">
      {/* Left icon rail */}
      <aside className="w-[80px] shrink-0 flex flex-col items-center py-6">
        <Link to="/dashboard">
          <Mark className="w-8 h-8" />
        </Link>
        <div className="mt-10 flex flex-col items-center gap-1.5 bg-white rounded-[26px] p-2 border border-black/5 shadow-sm">
          <RailIcon icon={Home} to="/dashboard" active={is("/dashboard")} />
          <RailIcon
            icon={Calendar}
            to="/my-trips"
            active={
              is("/my-trips") ||
              is("/trip-builder") ||
              is("/package-builder") ||
              is("/packages")
            }
          />
          <RailIcon icon={Search} to="/assistant" active={is("/assistant")} />
          <RailIcon icon={Users} to="/team" active={is("/team")} />
          <RailIcon icon={Settings} to="/settings" active={is("/settings")} />
        </div>
        <div className="mt-auto flex flex-col items-center gap-4">
          <Link
            to="/notifications"
            className="relative grid place-items-center w-11 h-11 rounded-2xl bg-white border border-black/5 text-[#10182a]/60 shadow-sm hover:text-[#10182a]"
          >
            <Bell className="w-[18px] h-[18px]" strokeWidth={2} />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#ff5a4d] ring-2 ring-white" />
          </Link>
          <div className="w-11 h-11 rounded-2xl bg-[#c7f135] text-[#10182a] grid place-items-center font-bold text-sm border border-black/5 shadow-sm">
            {initials}
          </div>
        </div>
      </aside>

      {/* Content surface */}
      <main className="flex-1 my-4 mr-4 rounded-[28px] bg-[#fbfbfb] border border-black/5 shadow-[0_20px_60px_-30px_rgba(16,24,42,0.35)] overflow-hidden flex flex-col min-w-0">
        <header className="flex items-center gap-6 px-8 pt-6 pb-4 border-b border-black/5 shrink-0">
          <div className="flex items-center gap-2 pr-4">
            <Sparkles className="w-4 h-4" style={{ color: "#c7f135" }} fill="#c7f135" />
            <span className="text-[15px] font-semibold tracking-tight">
              {title}
            </span>
          </div>
          {nav && (
            <div className="flex items-center gap-6 border-l border-black/10 pl-6">
              {nav}
            </div>
          )}
          {actions && (
            <div className="ml-auto flex items-center gap-2">{actions}</div>
          )}
        </header>
        <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
      </main>
    </div>
  );
};

export default AssistantFrame;
