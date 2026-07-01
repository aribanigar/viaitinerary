import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock, ArrowRight } from "lucide-react";
import Loader from "../common/Loader";
import { toast } from "react-toastify";
import logoLight from "../../assets/logo-light.png";

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await login(formData);

      if (data?.password_update_required) {
        toast.warning(
          "Your password needs an update to meet the latest security policy.",
        );
        navigate("/profile?password-update=1", { replace: true });
      } else {
        toast.success("Welcome back!");
        navigate("/dashboard");
      }
    } catch (err) {
      toast.error(err.message || "Login failed");
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f9f9f9] flex flex-col items-center justify-center px-4 py-8">
      <Link to="/" className="mb-4">
        <img
          src={logoLight}
          alt="ViaItinerary"
          className="h-20 w-auto object-contain"
        />
      </Link>
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold text-[#1a1c1c]">Welcome back</h2>
            <p className="text-slate-500 mt-2">
              Log in to your account to continue
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600 text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-[#1a1c1c] mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="email"
                  name="email"
                  id="email"
                  autoComplete="email"
                  placeholder="name@company.com"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1a1c1c]/5 focus:border-[#1a1c1c] transition-all text-[15px]"
                  required
                  onChange={handleChange}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-[#1a1c1c]">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-sm font-medium text-slate-500 hover:text-[#1a1c1c] transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  id="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full pl-11 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1a1c1c]/5 focus:border-[#1a1c1c] transition-all text-[15px]"
                  required
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#c7f135] text-[#10182a] py-3.5 rounded-xl text-[15px] font-bold hover:opacity-90 transition-all shadow-lg shadow-slate-200 disabled:opacity-70 flex items-center justify-center gap-2 group mt-2"
            >
              {loading ? (
                <>
                  <Loader size="sm" text="" inline color="text-white" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-slate-500 text-[15px]">
              Don't have an account?{" "}
              <Link
                to="/signup"
                className="font-bold text-[#1a1c1c] hover:underline underline-offset-4"
              >
                Create for free
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
