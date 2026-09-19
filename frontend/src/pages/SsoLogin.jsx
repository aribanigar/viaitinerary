import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";

/**
 * Lands here after web/app/api/sso/consume/route.js redirects a DMC partner
 * in from viakashmir.in. Stores the token exactly the way
 * AuthContext.login()/signup() do, then hard-navigates to /dashboard so
 * AuthProvider re-initialises from localStorage - no separate "SSO session"
 * concept on the frontend, it's the same auth state a normal login produces.
 */
export default function SsoLogin() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get("token");
    const error = searchParams.get("error");

    if (error) {
      toast.error(error);
      navigate("/login", { replace: true });
      return;
    }

    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    localStorage.setItem("token", token);
    localStorage.setItem("password_update_required", "false");
    const deviceId = searchParams.get("device_id");
    if (deviceId) localStorage.setItem("device_id", deviceId);

    // Full reload (not client-side navigate) so AuthProvider re-reads the
    // new token from localStorage on mount, same as it does after a normal
    // page load with an existing session.
    window.location.assign("/dashboard");
  }, [searchParams, navigate]);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
      <p style={{ color: "#6b7280", fontSize: 14 }}>Signing you in…</p>
    </div>
  );
}
