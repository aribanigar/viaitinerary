import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Loader from "../common/Loader";

const GuestRoute = () => {
  const { token, loading } = useAuth();

  if (loading) {
    return <Loader fullPage text="Checking authentication..." />;
  }

  // If user is already logged in, redirect to dashboard
  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  // Not logged in, allow access to guest pages (Login, Signup, etc.)
  return <Outlet />;
};

export default GuestRoute;
