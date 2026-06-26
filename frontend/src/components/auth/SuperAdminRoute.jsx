import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Loader from "../common/Loader";

const SuperAdminRoute = () => {
  const { user, token, loading } = useAuth();

  if (loading) {
    return <Loader fullPage text="Checking authentication..." />;
  }

  if (!token) {
    return <Navigate to="/" replace />;
  }

  if (user?.role !== "super_admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default SuperAdminRoute;
