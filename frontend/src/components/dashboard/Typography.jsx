import React, { useState, useEffect } from "react";
import DashboardLayout from "./DashboardLayout";
import { Save, Loader2, Palette, Type, MessageCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { fetchSettings, updateSettings } from "../../api/settings";
import Loader from "../common/Loader";
import { toast } from "react-toastify";
import FontPicker from "react-fontpicker-ts-lite";
import "react-fontpicker-ts-lite/dist/index.css";

const Typography = () => {
  const { token } = useAuth();
  const [fullSettings, setFullSettings] = useState(null);
  const [formData, setFormData] = useState({
    brandColor: "#F4A229",
    secondaryColor: "#0D2D2D",
    fontFamily: "Montserrat",
    greetingMessage: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await fetchSettings(token);
        if (data) {
          setFullSettings(data); // Store complete settings
          setFormData({
            brandColor: data.brandColor || "#F4A229",
            secondaryColor: data.secondaryColor || "#0D2D2D",
            fontFamily: data.fontFamily || "Montserrat",
            greetingMessage: data.greetingMessage || "",
          });
        }
      } catch (err) {
        console.error("Failed to load typography settings:", err);
      } finally {
        setLoading(false);
      }
    }
    if (token) loadSettings();
  }, [token]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      // Merge typography changes with full settings
      const payload = {
        ...fullSettings,
        ...formData,
      };
      console.log("Saving formData.fontFamily:", formData.fontFamily);
      console.log("Complete payload:", payload);
      await updateSettings(token, payload);
      toast.success("Typography settings saved successfully!");
    } catch (err) {
      console.error("Save failed:", err);
      toast.error(err.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader text="Loading your typography settings..." />
        </div>
      );
    }

    return (
      <div className="max-w-5xl">
        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-2 mb-8 text-[#1b1b1b]">
            <Palette className="w-5 h-5" />
            <h2 className="text-lg font-bold text-slate-900">Brand Colors</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1">
                Primary Color
              </label>
              <div className="flex items-center gap-3 p-1.5 bg-slate-50 border border-slate-200 rounded-xl">
                <input
                  type="color"
                  name="brandColor"
                  value={formData.brandColor}
                  onChange={handleInputChange}
                  className="w-12 h-10 rounded-lg cursor-pointer bg-transparent border-none appearance-none [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border-none"
                />
                <span className="text-sm font-bold text-slate-600 uppercase tracking-wider pr-4">
                  {formData.brandColor}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1">
                Secondary Color
              </label>
              <div className="flex items-center gap-3 p-1.5 bg-slate-50 border border-slate-200 rounded-xl">
                <input
                  type="color"
                  name="secondaryColor"
                  value={formData.secondaryColor}
                  onChange={handleInputChange}
                  className="w-12 h-10 rounded-lg cursor-pointer bg-transparent border-none appearance-none [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border-none"
                />
                <span className="text-sm font-bold text-slate-600 uppercase tracking-wider pr-4">
                  {formData.secondaryColor}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-100">
            <div className="flex items-center gap-2 mb-8 text-[#1b1b1b]">
              <Type className="w-5 h-5" />
              <h2 className="text-lg font-bold text-slate-900">Font Family</h2>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1">
                  Select Google Font
                </label>

                {/* Manual Input - Temporary Workaround */}
                <input
                  type="text"
                  name="fontFamily"
                  value={formData.fontFamily}
                  onChange={handleInputChange}
                  placeholder="Enter Google Font name (e.g., Roboto, Open Sans)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
                <p className="text-[9px] text-slate-400 font-medium">
                  Type the exact Google Font name. Popular fonts: Montserrat,
                  Roboto, Open Sans, Lato, Poppins
                </p>

                {/* FontPicker - Currently Not Working */}
                {/* <div className="font-picker-container">
                  <FontPicker
                    defaultValue={formData.fontFamily}
                    onChange={(nextFont) => {
                      console.log(
                        "FontPicker onChange called with:",
                        nextFont,
                        typeof nextFont,
                      );
                      const newFont =
                        typeof nextFont === "string"
                          ? nextFont
                          : nextFont?.family || String(nextFont);
                      console.log("Updating fontFamily to:", newFont);
                      if (newFont) {
                        setFormData((prev) => {
                          console.log(
                            "Previous state:",
                            prev.fontFamily,
                            "New state:",
                            newFont,
                          );
                          return {
                            ...prev,
                            fontFamily: newFont,
                          };
                        });
                      }
                    }}
                  />
                </div>
                <style>{`
                  .font-picker-container .font-picker-display {
                    width: 100% !important;
                    background-color: #f9f9f9 !important;
                    border: 1px solid #e2e8f0 !important;
                    border-radius: 0.75rem !important;
                    padding: 0.75rem 1rem !important;
                    font-weight: 700 !important;
                    color: #1b1b1b !important;
                  }
                  .font-picker-container .font-picker-dropdown {
                    z-index: 50 !important;
                    border-radius: 0.75rem !important;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1) !important;
                  }
                `}</style>
                <p className="text-[9px] text-slate-400 font-medium">
                  Note: The dropdown allows you to preview and select from
                  hundreds of Google Fonts.
                </p> */}
              </div>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-100">
            <div className="flex items-center gap-2 mb-8 text-[#1b1b1b]">
              <MessageCircle className="w-5 h-5" />
              <h2 className="text-lg font-bold text-slate-900">
                Communication
              </h2>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1.5">
                Greeting Message
              </label>
              <textarea
                name="greetingMessage"
                value={formData.greetingMessage}
                onChange={handleInputChange}
                placeholder="Enter your custom greeting message"
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-vertical"
              />
              <p className="text-[9px] text-slate-400 font-medium">
                Use {"{agencyName}"} to dynamically insert your agency name
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 leading-tight">
            Typography & Branding
          </h1>
          <p className="text-slate-400 font-medium mt-1">
            Customize your brand colors for itineraries and client
            communication.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full md:w-auto flex items-center justify-center gap-2 bg-[#1b1b1b] text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Save Changes
            </>
          )}
        </button>
      </div>

      {renderContent()}
    </DashboardLayout>
  );
};

export default Typography;
