import React, { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { resetPassword } from "../../api/auth";
import {
  Eye,
  EyeOff,
  Mail,
  ShieldCheck,
  Lock,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import Loader from "../common/Loader";
import { toast } from "react-toastify";
import logoLight from "../../assets/ViaKashmir logo for light bg.png";

const ResetPassword = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const emailFromState = location.state?.email || "";

  const [formData, setFormData] = useState({
    email: emailFromState,
    otp: "",
    password: "",
    password_confirmation: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (formData.password !== formData.password_confirmation) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      await resetPassword(formData);
      toast.success("Password reset successfully!");
      setSuccess(true);
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (err) {
      toast.error(err.message || "Failed to reset password");
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center px-4 py-8">
        <Link to="/" className="mb-4">
          <img
            src={logoLight}
            alt="VIAKashmir"
            className="h-20 w-auto object-contain"
          />
        </Link>
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8 text-center">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-[#143B36]">Success!</h2>
            <p className="mt-4 text-slate-500">
              Your password has been reset successfully. Redirecting you to
              login...
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 mt-8 text-[#143B36] font-bold hover:underline underline-offset-4"
            >
              Go to Login now
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center px-4 py-8">
      <Link to="/" className="mb-4">
        <img
          src={logoLight}
          alt="VIAKashmir"
          className="h-20 w-auto object-contain"
        />
      </Link>
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8">
          <div className="mb-6 text-center">
            <h2 className="text-3xl font-bold text-[#143B36]">
              Reset Password
            </h2>
            <p className="text-slate-500 mt-2">
              Create a new secure password for your account
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600 text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#143B36] mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="name@company.com"
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#143B36]/5 focus:border-[#143B36] transition-all text-[15px] cursor-not-allowed opacity-70"
                  required
                  readOnly={!!emailFromState}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#143B36] mb-1.5">
                6-Digit Reset Code
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <ShieldCheck className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  name="otp"
                  value={formData.otp}
                  onChange={handleChange}
                  placeholder="123456"
                  maxLength="6"
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#143B36]/5 focus:border-[#143B36] transition-all text-[15px]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#143B36] mb-1.5">
                New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#143B36]/5 focus:border-[#143B36] transition-all text-[15px]"
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#143B36] mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="password_confirmation"
                  value={formData.password_confirmation}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#143B36]/5 focus:border-[#143B36] transition-all text-[15px]"
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Password must be at least 8 characters and include uppercase,
              lowercase, number, and special character.
            </p>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#143B36] text-white py-3.5 rounded-xl text-[15px] font-bold hover:opacity-90 transition-all shadow-lg shadow-slate-200 disabled:opacity-70 flex items-center justify-center gap-2 group mt-4"
            >
              {loading ? (
                <>
                  <Loader size="sm" text="" inline color="text-white" />
                  <span>Updating password...</span>
                </>
              ) : (
                <>
                  Update Password
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
