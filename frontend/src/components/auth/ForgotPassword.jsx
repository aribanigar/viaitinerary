import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { forgotPassword } from "../../api/auth";
import { Mail, ArrowRight, ArrowLeft } from "lucide-react";
import Loader from "../common/Loader";
import { toast } from "react-toastify";
import logoLight from "../../assets/logo-light.png";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await forgotPassword(email);
      toast.success("Reset code sent to your email!");
      navigate("/reset-password", { state: { email } });
    } catch (err) {
      toast.error(err.message || "Failed to send reset code");
      setError(err.message || "Failed to send reset code");
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
          <div className="mb-6 text-center">
            <h2 className="text-3xl font-bold text-[#1a1c1c]">
              Forgot password?
            </h2>
            <p className="text-slate-500 mt-2">
              Enter your email address and we'll send you a code to reset your
              password.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600 text-center">
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1a1c1c]/5 focus:border-[#1a1c1c] transition-all text-[15px]"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1a1c1c] text-white py-3.5 rounded-xl text-[15px] font-bold hover:opacity-90 transition-all shadow-lg shadow-slate-200 disabled:opacity-70 flex items-center justify-center gap-2 group mt-2"
            >
              {loading ? (
                <>
                  <Loader size="sm" text="" inline color="text-white" />
                  <span>Sending Code...</span>
                </>
              ) : (
                <>
                  Send Reset Code
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-slate-500 hover:text-[#1a1c1c] font-medium transition-colors text-[15px]"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
