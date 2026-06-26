import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Loader from "../common/Loader";

const ProtectedRoute = ({ allowedRoles = [] }) => {
  const { user, token, loading, passwordUpdateRequired } = useAuth();
  const location = useLocation();

  if (loading) {
    return <Loader fullPage text="Checking authentication..." />;
  }

  if (!token) {
    return <Navigate to="/" replace />;
  }

  if (passwordUpdateRequired && location.pathname !== "/profile") {
    return <Navigate to="/profile?password-update=1" replace />;
  }

  // Check roles if specified
  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
