import React, { useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import NavRail from "./NavRail";
import { BottomTabBar } from "./AssistantFrame";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const DashboardLayout = ({ children, noPadding = false }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { token, user } = useAuth();
  const { pathname } = useLocation();

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="app-shell flex h-[100dvh] bg-[#eef0f1] overflow-hidden">
      {/* Mobile: fixed drawer. Desktop: replaced by the collapsible NavRail. */}
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
      <NavRail />

      {/* Main Content Area — floating rounded surface (AI-assistant look) */}
      {/* Phones: edge to edge (no frame eating the width) with the app's
          bottom tab bar; desktop: the floating rounded surface. */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden lg:py-3 lg:pr-3 lg:pl-0">
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#fbfbfb] lg:rounded-[24px] lg:border lg:border-black/5 lg:shadow-[0_18px_50px_-28px_rgba(16,24,42,0.35)]">
          <Header onMenuClick={toggleSidebar} />
          <main
            className={`flex-1 ${noPadding ? "p-0 overflow-y-auto lg:overflow-hidden" : "px-3.5 pt-4 sm:p-6 md:p-8 overflow-y-auto"} pb-[calc(76px+env(safe-area-inset-bottom))] lg:pb-8`}
          >
            <div
              className={`${noPadding ? "max-w-none h-full" : "max-w-7xl mx-auto"}`}
            >
              {children}
            </div>
          </main>
        </div>
      </div>
      <BottomTabBar is={(p) => pathname.startsWith(p)} />
    </div>
  );
};

export default DashboardLayout;
