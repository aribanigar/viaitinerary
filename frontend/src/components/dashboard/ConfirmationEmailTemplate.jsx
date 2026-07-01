import React, { useState, useEffect, useRef } from "react";
import DashboardLayout from "./DashboardLayout";
import {
  Save,
  Loader2,
  Mail,
  MessageSquare,
  Image as ImageIcon,
  Upload,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { fetchSettings, updateSettings } from "../../api/settings";
import Loader from "../common/Loader";
import { toast } from "react-toastify";

const ConfirmationEmailTemplate = () => {
  const { token } = useAuth();
  const fileInputRef = useRef(null);
  const emailMsgRef = useRef(null);
  const pdfMsgRef = useRef(null);
  const [fullSettings, setFullSettings] = useState(null);
  const [formData, setFormData] = useState({
    confirmationMessage: "",
    confirmationPdfMessage: "",
    confirmationHeroImage: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await fetchSettings(token);
        if (data) {
          setFullSettings(data);
          setFormData({
            confirmationMessage: data.confirmationMessage || "",
            confirmationPdfMessage: data.confirmationPdfMessage || "",
            confirmationHeroImage: data.confirmationHeroImage || null,
          });
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
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

  const insertTag = (fieldName, tag) => {
    const textarea =
      fieldName === "confirmationMessage"
        ? emailMsgRef.current
        : pdfMsgRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData[fieldName];
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);

    setFormData((prev) => ({
      ...prev,
      [fieldName]: before + tag + after,
    }));

    // Focus back and set cursor position after a small delay to let state update
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 0);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({
          ...prev,
          confirmationHeroImage: reader.result,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setFormData((prev) => ({ ...prev, confirmationHeroImage: null }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        ...fullSettings,
        ...formData,
      };
      await updateSettings(token, payload);
      toast.success("Confirmation email template saved successfully!");
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
          <Loader text="Loading your template settings..." />
        </div>
      );
    }

    return (
      <div className="max-w-5xl">
        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-2 mb-8 text-[#1b1b1b]">
            <Mail className="w-5 h-5" />
            <h2 className="text-lg font-bold text-slate-900">
              Confirmation Email Template
            </h2>
          </div>

          <div className="space-y-6">
            {/* Hero Image Section */}
            <div className="space-y-4 p-6 bg-slate-50 border border-slate-100 rounded-xl">
              <div className="flex items-center gap-2 mb-1 text-slate-700">
                <ImageIcon className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-widest">
                  Hero Section Cover Image
                </span>
              </div>

              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="relative w-full md:w-64 aspect-video bg-white border-2 border-dashed border-slate-200 rounded-xl overflow-hidden group flex items-center justify-center">
                  {formData.confirmationHeroImage ? (
                    <>
                      <img
                        src={formData.confirmationHeroImage}
                        alt="Hero Preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={removeImage}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 shadow-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <div className="text-center p-4">
                      <div className="mx-auto w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mb-2">
                        <Upload className="w-5 h-5 text-slate-400" />
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        No Image Selected
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-3">
                  <p className="text-[11px] font-medium text-slate-500 leading-relaxed italic">
                    This image will be used as the main cover photo at the top
                    of the booking confirmation PDF. Accepted formats: JPG,
                    JPEG, PNG, WebP.
                  </p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageChange}
                    accept=".jpg,.jpeg,.png,.webp"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-95 shadow-sm"
                  >
                    <Upload className="w-4 h-4" />
                    {formData.confirmationHeroImage
                      ? "Change Image"
                      : "Upload Hero Image"}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-1.5 p-6 bg-blue-50/50 border border-blue-100 rounded-xl">
              <div className="flex items-center gap-2 mb-3 text-blue-700">
                <MessageSquare className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-widest">
                  PDF Header Message
                </span>
              </div>
              <textarea
                name="confirmationPdfMessage"
                ref={pdfMsgRef}
                value={formData.confirmationPdfMessage}
                onChange={handleInputChange}
                className="w-full h-48 px-6 py-5 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-[#1b1b1b] transition-all resize-none text-slate-700 font-medium leading-relaxed"
                placeholder="Enter the greeting message for the confirmation PDF..."
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    insertTag("confirmationPdfMessage", "{agencyName}")
                  }
                  className="px-3 py-1.5 bg-blue-100 text-[#1b1b1b] text-[10px] font-bold rounded-lg border border-blue-200 hover:bg-blue-200 transition-colors"
                >
                  {`{agencyName}`}
                </button>
                <button
                  onClick={() =>
                    insertTag("confirmationPdfMessage", "{clientName}")
                  }
                  className="px-3 py-1.5 bg-blue-100 text-[#1b1b1b] text-[10px] font-bold rounded-lg border border-blue-200 hover:bg-blue-200 transition-colors"
                >
                  {`{clientName}`}
                </button>
              </div>
              <p className="mt-4 text-[11px] font-medium text-slate-500 leading-relaxed px-1">
                This message will appear at the top of the booking confirmation
                PDF. Use the tags above to automatically insert details.
              </p>
            </div>

            <div className="space-y-1.5 p-6 bg-blue-50/50 border border-blue-100 rounded-xl">
              <div className="flex items-center gap-2 mb-3 text-blue-700">
                <MessageSquare className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-widest">
                  Email & WhatsApp Message
                </span>
              </div>
              <textarea
                name="confirmationMessage"
                ref={emailMsgRef}
                value={formData.confirmationMessage}
                onChange={handleInputChange}
                className="w-full h-48 px-6 py-5 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-[#1b1b1b] transition-all resize-none text-slate-700 font-medium leading-relaxed"
                placeholder="Enter the greeting message for confirmation emails..."
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    insertTag("confirmationMessage", "{agencyName}")
                  }
                  className="px-3 py-1.5 bg-blue-100 text-[#1b1b1b] text-[10px] font-bold rounded-lg border border-blue-200 hover:bg-blue-200 transition-colors"
                >
                  {`{agencyName}`}
                </button>
                <button
                  onClick={() =>
                    insertTag("confirmationMessage", "{clientName}")
                  }
                  className="px-3 py-1.5 bg-blue-100 text-[#1b1b1b] text-[10px] font-bold rounded-lg border border-blue-200 hover:bg-blue-200 transition-colors"
                >
                  {`{clientName}`}
                </button>
              </div>
              <p className="mt-4 text-[11px] font-medium text-slate-500 leading-relaxed px-1">
                This message will appear as the main body of the confirmation
                email or WhatsApp message. Use the tags above to automatically
                insert details.
              </p>
            </div>

            <div className="pt-6 border-t border-slate-100 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-[#1b1b1b] text-white rounded-xl font-bold transition-all hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed group min-w-[180px]"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout
      title="Confirmation Email"
      subtitle="Customize your booking confirmation messages"
    >
      {renderContent()}
    </DashboardLayout>
  );
};

export default ConfirmationEmailTemplate;
