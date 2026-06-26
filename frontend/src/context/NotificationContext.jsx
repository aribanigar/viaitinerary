import React, { createContext, useContext, useState, useEffect } from "react";
import { getUnreadCount } from "../api/notifications";
import { useAuth } from "./AuthContext";

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = async () => {
    if (!user) return;
    try {
      const data = await getUnreadCount();
      setUnreadCount(data.unread_count);
    } catch (error) {
      console.error("Error fetching notification count:", error);
    }
  };

  useEffect(() => {
    if (user) {
      refreshUnreadCount();
      const interval = setInterval(refreshUnreadCount, 60000);
      return () => clearInterval(interval);
    } else {
      setUnreadCount(0);
    }
  }, [user]);

  return (
    <NotificationContext.Provider
      value={{ unreadCount, setUnreadCount, refreshUnreadCount }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider",
    );
  }
  return context;
};
