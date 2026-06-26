import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { PhoneInput } from "react-international-phone";
import "react-international-phone/style.css";
import {
  Eye,
  EyeOff,
  User,
  Mail,
  Phone,
  Lock,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import Loader from "../common/Loader";
import { toast } from "react-toastify";
import logoLight from "../../assets/ViaKashmir logo for light bg.png";

const Signup = () => {
  const { signup, sendOtp } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    password_confirmation: "",
    otp: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpMessage, setOtpMessage] = useState("");
  const [resendTimer, setResendTimer] = useState(0);

  // Persistence logic for OTP Resend Timer
  React.useEffect(() => {
    const lastSentAt = localStorage.getItem("otp_last_sent");
    if (lastSentAt) {
      const elapsed = Math.floor((Date.now() - parseInt(lastSentAt)) / 1000);
      if (elapsed < 60) {
        setResendTimer(60 - elapsed);
        setOtpSent(true);
      }
    }
  }, []);

  React.useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSendOtp = async () => {
    if (!formData.email) {
      setError("Please enter your email first");
      return;
    }
    setOtpLoading(true);
    setError("");
    setOtpMessage("");
    try {
      await sendOtp(formData.email);
      setOtpSent(true);
      setResendTimer(60);
      localStorage.setItem("otp_last_sent", Date.now().toString());
      toast.info("OTP sent to your email!");
      setOtpMessage("OTP sent to your email!");
    } catch (err) {
      toast.error(err.message || "Failed to send OTP");
      setError(err.message || "Failed to send OTP");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signup(formData);
      localStorage.removeItem("otp_last_sent");
      toast.success("Account created successfully!");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.message || "Signup failed");
      setError(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center px-4 py-8">
      <Link to="/" className="mb-4">
        <img
          src={logoLight}
          alt="VIAKashmir"
          className="h-20 w-auto object-contain"
        />
      </Link>
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8">
          <div className="mb-6 text-center">
            <h2 className="text-3xl font-bold text-[#143B36]">
              Create Account
            </h2>
            <p className="text-slate-500 mt-2">
              Join VIAKashmir and start managing your travel business
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600 text-center">
              {error}
            </div>
          )}
          {otpMessage && (
            <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-100 text-sm text-green-600 text-center">
              {otpMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-[#143B36] mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    name="name"
                    id="name"
                    autoComplete="name"
                    placeholder="John Doe"
                    className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#143B36]/5 focus:border-[#143B36] transition-all text-[15px]"
                    required
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#143B36] mb-1.5">
                  Phone Number
                </label>
                <div className="relative phone-input-container">
                  <PhoneInput
                    defaultCountry="in"
                    value={formData.phone}
                    onChange={(phone) =>
                      setFormData({ ...formData, phone: phone })
                    }
                    inputClassName="w-full pl-11 pr-4 py-2.5 bg-slate-50 border-none rounded-xl focus:outline-none transition-all text-[15px]"
                    containerClassName="w-full"
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#143B36] mb-1.5">
                Email Address
              </label>
              <div className="flex gap-2">
                <div className="relative flex-grow">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    name="email"
                    id="email"
                    autoComplete="email"
                    placeholder="name@company.com"
                    className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#143B36]/5 focus:border-[#143B36] transition-all text-[15px]"
                    required
                    onChange={handleChange}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={otpLoading || !formData.email || resendTimer > 0}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-[#143B36] text-sm font-bold rounded-xl transition-all disabled:opacity-50 whitespace-nowrap min-w-[120px]"
                >
                  {otpLoading
                    ? "Sending..."
                    : resendTimer > 0
                      ? `Resend in ${resendTimer}s`
                      : otpSent
                        ? "Resend OTP"
                        : "Send OTP"}
                </button>
              </div>
            </div>

            {otpSent && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="block text-sm font-semibold text-[#143B36] mb-1.5">
                  Verification Code (OTP)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <ShieldCheck className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    name="otp"
                    id="otp"
                    placeholder="6-digit code"
                    maxLength="6"
                    className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#143B36]/5 focus:border-[#143B36] transition-all text-[15px]"
                    required
                    onChange={handleChange}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-[#143B36] mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    id="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="w-full pl-11 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#143B36]/5 focus:border-[#143B36] transition-all text-[15px]"
                    required
                    onChange={handleChange}
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
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="password_confirmation"
                    id="password_confirmation"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="w-full pl-11 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#143B36]/5 focus:border-[#143B36] transition-all text-[15px]"
                    required
                    onChange={handleChange}
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
                  <span>Creating account...</span>
                </>
              ) : (
                <>
                  Get started for free
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-slate-500 text-[15px]">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-bold text-[#143B36] hover:underline underline-offset-4"
              >
                Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
