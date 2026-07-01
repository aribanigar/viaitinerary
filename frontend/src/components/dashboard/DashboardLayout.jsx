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
    <div className="flex h-screen bg-[#f9f9f9] overflow-hidden">
      {/* Sidebar - Mobile: Fixed Drawer, Desktop: Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onMenuClick={toggleSidebar} />
        <main
          className={`flex-1 ${noPadding ? "p-0 overflow-y-auto lg:overflow-hidden" : "p-4 md:p-8 lg:p-12 overflow-y-auto"}`}
        >
          <div
            className={`${noPadding ? "max-w-none h-full" : "max-w-7xl mx-auto"}`}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
