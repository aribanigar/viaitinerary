import React from "react";
import { Link } from "react-router-dom";
import { Home, ArrowLeft } from "lucide-react";
import logoLight from "../assets/ViaKashmir logo for light bg.png";

const NotFound = () => {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center px-4 py-8">
      <Link to="/" className="mb-8">
        <img
          src={logoLight}
          alt="VIAKashmir"
          className="h-20 w-auto object-contain"
        />
      </Link>

      <div className="w-full max-w-lg text-center">
        <div className="relative mb-8">
          <h1 className="text-[12rem] font-black text-[#143B36]/5 leading-none select-none">
            404
          </h1>
        </div>

        <h2 className="text-3xl font-bold text-[#143B36] mb-4">
          Oops! Page not found
        </h2>
        <p className="text-slate-500 text-lg mb-10 max-w-md mx-auto">
          The page you are looking for might have been removed, had its name
          changed, or is temporarily unavailable.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => window.history.back()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-white border border-slate-200 text-[#143B36] font-semibold rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
          >
            <ArrowLeft className="h-5 w-5" />
            Go Back
          </button>
          <Link
            to="/"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-[#143B36] text-white font-semibold rounded-xl hover:bg-[#143B36]/90 transition-all shadow-lg shadow-[#143B36]/20"
          >
            <Home className="h-5 w-5" />
            Back to Home
          </Link>
        </div>
      </div>

      <div className="mt-16 text-slate-400 text-sm">
        &copy; {new Date().getFullYear()} VIAKashmir. All rights reserved.
      </div>
    </div>
  );
};

export default NotFound;
