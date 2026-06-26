import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import * as authApi from "../api/auth";
import { toast } from "react-toastify";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [passwordUpdateRequired, setPasswordUpdateRequired] = useState(
    localStorage.getItem("password_update_required") === "true",
  );
  const [loading, setLoading] = useState(true);
  const handlingUnauthorizedRef = useRef(false);

  const clearAuthState = useCallback(() => {
    setUser(null);
    setToken(null);
    setPasswordUpdateRequired(false);
    localStorage.removeItem("token");
    localStorage.removeItem("password_update_required");
    sessionStorage.removeItem("dashboard_offer_shown");
  }, []);

  useEffect(() => {
    const handleUnauthorized = (event) => {
      if (event.detail.status === 401 && !handlingUnauthorizedRef.current) {
        handlingUnauthorizedRef.current = true;

        // Clear stale auth values first so header/guards immediately switch to guest UI.
        clearAuthState();
        toast.error(
          event.detail.message || "Session expired. Please login again.",
        );

        if (window.location.pathname !== "/") {
          window.location.assign("/");
        }

        setTimeout(() => {
          handlingUnauthorizedRef.current = false;
        }, 0);
      }
    };

    window.addEventListener("unauthorized-access", handleUnauthorized);
    return () =>
      window.removeEventListener("unauthorized-access", handleUnauthorized);
  }, [clearAuthState]);

  useEffect(() => {
    if (token) {
      authApi
        .getMe(token)
        .then((userData) => {
          setUser(userData);
          setLoading(false);
        })
        .catch(() => {
          clearAuthState();
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [token, clearAuthState]);

  const login = async (credentials) => {
    const data = await authApi.login(credentials);
    setUser(data.user);
    setToken(data.access_token);
    setPasswordUpdateRequired(Boolean(data.password_update_required));
    localStorage.setItem("token", data.access_token);
    localStorage.setItem(
      "password_update_required",
      String(Boolean(data.password_update_required)),
    );
    if (data.device_id) {
      localStorage.setItem("device_id", data.device_id);
    }
    return data;
  };

  const signup = async (userData) => {
    const data = await authApi.signup(userData);
    setUser(data.user);
    setToken(data.access_token);
    setPasswordUpdateRequired(false);
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("password_update_required", "false");
    if (data.device_id) {
      localStorage.setItem("device_id", data.device_id);
    }
    return data;
  };

  const markPasswordUpdated = () => {
    setPasswordUpdateRequired(false);
    localStorage.setItem("password_update_required", "false");
  };

  const sendOtp = async (email) => {
    return await authApi.sendOtp(email);
  };

  const logout = async () => {
    const currentToken = token;

    clearAuthState();

    if (currentToken) {
      try {
        await authApi.logout(currentToken);
      } catch (error) {
        console.error("Logout failed", error);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        token,
        loading,
        passwordUpdateRequired,
        login,
        signup,
        logout,
        sendOtp,
        markPasswordUpdated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
