import React, { useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { useAuth } from "../../context/AuthContext";

const DashboardLayout = ({ children, noPadding = false }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { token, user } = useAuth();

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex h-screen bg-[#eef0f1] overflow-hidden">
      {/* Sidebar - Mobile: Fixed Drawer, Desktop: Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

      {/* Main Content Area — floating rounded surface (AI-assistant look) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden p-2.5 lg:p-3">
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden rounded-[24px] bg-[#fbfbfb] border border-black/5 shadow-[0_18px_50px_-28px_rgba(16,24,42,0.35)]">
          <Header onMenuClick={toggleSidebar} />
          <main
            className={`flex-1 ${noPadding ? "p-0 overflow-y-auto lg:overflow-hidden" : "p-4 md:p-8 overflow-y-auto"}`}
          >
            <div
              className={`${noPadding ? "max-w-none h-full" : "max-w-7xl mx-auto"}`}
            >
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;
