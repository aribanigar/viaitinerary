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

const USER_CACHE_KEY = "auth_user";

const readCachedUser = () => {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  // With a token and a remembered user, render straight away and revalidate
  // /api/user in the background, instead of holding every page load behind
  // that round trip. The server still authorizes every request, so a stale
  // cached role can't grant anything.
  const [user, setUser] = useState(() =>
    localStorage.getItem("token") ? readCachedUser() : null,
  );
  const [passwordUpdateRequired, setPasswordUpdateRequired] = useState(
    localStorage.getItem("password_update_required") === "true",
  );
  const [loading, setLoading] = useState(
    () => Boolean(localStorage.getItem("token")) && !readCachedUser(),
  );
  const handlingUnauthorizedRef = useRef(false);

  useEffect(() => {
    try {
      if (user) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
      else localStorage.removeItem(USER_CACHE_KEY);
    } catch {
      // Storage full/blocked — the cache is only a speed-up.
    }
  }, [user]);

  const clearAuthState = useCallback(() => {
    setUser(null);
    setToken(null);
    setPasswordUpdateRequired(false);
    localStorage.removeItem("token");
    localStorage.removeItem(USER_CACHE_KEY);
    localStorage.removeItem("password_update_required");
    sessionStorage.removeItem("dashboard_offer_shown");
  }, []);

  useEffect(() => {
    const handleUnauthorized = (event) => {
      const { status, token: failedToken } = event.detail || {};
      if (status !== 401) return;
      // A 401 for a token that has already been replaced (a request still in
      // flight from before the latest login) says nothing about the current
      // session — acting on it logged people straight back out.
      if (failedToken && failedToken !== localStorage.getItem("token")) return;
      if (!handlingUnauthorizedRef.current) {
        handlingUnauthorizedRef.current = true;

        // Clear stale auth values first so header/guards immediately switch to guest UI.
        // No hard redirect: clearing auth makes ProtectedRoute send the user
        // to /login (and back afterwards). The old full-page jump to the
        // marketing homepage also reloaded away this toast before it showed.
        clearAuthState();
        toast.error("Your session has expired. Please sign in again.");

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
    if (!token) {
      setLoading(false);
      return;
    }
    // Ignore the result if the token changed while this was in flight — an
    // old token's 401 landing after a fresh login used to wipe the new
    // session and send the user back to the homepage.
    let stale = false;
    authApi
      .getMe(token)
      .then((userData) => {
        if (stale) return;
        setUser(userData);
        setLoading(false);
      })
      .catch((err) => {
        if (stale) return;
        // Only a real 401 means the token is actually invalid. Any other
        // failure (a transient DB/network blip) must not log the user out.
        if (err?.status === 401) {
          clearAuthState();
        }
        setLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [token, clearAuthState]);

  const login = async (credentials) => {
    const data = await authApi.login(credentials);
    setUser(data.user);
    setToken(data.access_token);
    setLoading(false);
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
    setLoading(false);
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
