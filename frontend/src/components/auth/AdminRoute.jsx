import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Loader from "../common/Loader";

const AdminRoute = () => {
  const { user, token, loading } = useAuth();

  if (loading) {
    return <Loader fullPage text="Checking permissions..." />;
  }

  if (!token) {
    return <Navigate to="/" replace />;
  }

  if (user?.role !== "admin" && user?.role !== "super_admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default AdminRoute;
