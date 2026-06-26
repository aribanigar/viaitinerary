import React, { useState, useEffect } from "react";
import { Search, Bell, LogOut, Menu, Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { useNotifications } from "../../context/NotificationContext";

const Header = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      navigate("/");
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shrink-0 sticky top-0 z-40 backdrop-blur-sm bg-white/90">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="relative w-64 md:w-96 hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search trips, clients..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
          />
        </div>
      </div>
      <div className="flex items-center gap-2 md:gap-4 text-[#10182A]">
        <div className="flex items-center gap-3 mr-2 md:mr-4 hidden xs:flex">
          <div className="text-right">
            <p className="text-sm font-semibold truncate max-w-[100px] md:max-w-none">
              {user?.name || "User"}
            </p>
            <p className="text-xs text-slate-500 hidden md:block">
              {user?.email}
            </p>
          </div>
        </div>
        <Link
          to="/notifications"
          className="relative w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 cursor-pointer hover:bg-slate-100 transition-colors group"
        >
          <Bell className="w-5 h-5 group-hover:rotate-12 transition-transform" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 cursor-pointer hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Logout"
        >
          {isLoggingOut ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <LogOut className="w-5 h-5" />
          )}
        </button>
      </div>
    </header>
  );
};

export default Header;
