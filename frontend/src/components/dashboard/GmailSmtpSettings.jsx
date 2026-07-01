import React, { useEffect, useState } from "react";
import { Save, KeyRound, Eye, EyeOff, Loader2, Send } from "lucide-react";
import { toast } from "react-toastify";
import DashboardLayout from "./DashboardLayout";
import Loader from "../common/Loader";
import { useAuth } from "../../context/AuthContext";
import {
  fetchSettings,
  updateSettings,
  sendSmtpTest,
} from "../../api/settings";

const GmailSmtpSettings = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [formData, setFormData] = useState({
    smtpEmail: "",
    smtpHost: "",
    smtpPort: 587,
    smtpEncryption: "tls",
    smtpAppPassword: "",
    hasSmtpPassword: false,
  });
  const [testEmail, setTestEmail] = useState("");

  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await fetchSettings(token);
        if (data) {
          setFormData((prev) => ({
            ...prev,
            ...data,
            smtpPort: data.smtpPort ?? prev.smtpPort,
            smtpEncryption: data.smtpEncryption ?? prev.smtpEncryption,
          }));
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

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = { ...formData };
      if (!payload.smtpAppPassword) delete payload.smtpAppPassword;
      delete payload.hasSmtpPassword;

      await updateSettings(token, payload);
      toast.success("SMTP settings saved!");
    } catch (err) {
      console.error("Save failed:", err);
      toast.error(err.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail) {
      toast.error("Please enter a test email address.");
      return;
    }

    try {
      setTesting(true);
      await sendSmtpTest(token, testEmail);
      toast.success("Test email sent successfully!");
    } catch (err) {
      console.error("Test email failed:", err);
      toast.error(err.message || "Failed to send test email.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 leading-tight">
            Email Connect
          </h1>
          <p className="text-slate-400 font-medium mt-1">
            Connect any SMTP provider to send emails from your agency address.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={loading || saving}
          className="w-full md:w-auto flex items-center justify-center gap-2 bg-[#c7f135] text-[#10182a] px-6 py-3 rounded-xl font-bold shadow-lg shadow-[#c7f135]/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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

      {loading ? (
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader text="Loading your SMTP settings..." />
        </div>
      ) : (
        <div className="max-w-4xl">
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm transition-all hover:shadow-md flex flex-col">
            <div className="flex items-center gap-2 mb-6 text-[#1b1b1b]">
              <KeyRound className="w-5 h-5" />
              <h2 className="text-base font-bold text-slate-900">
                SMTP Configuration
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  SMTP Username / Email
                </label>
                <input
                  type="email"
                  name="smtpEmail"
                  value={formData.smtpEmail || ""}
                  onChange={handleInputChange}
                  placeholder="name@provider.com"
                  autoComplete="off"
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-slate-900 text-sm font-bold focus:ring-2 focus:ring-[#c7f135]/20 focus:border-[#c7f135] outline-none transition-all placeholder:font-medium placeholder:text-slate-300"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  SMTP Host
                </label>
                <input
                  type="text"
                  name="smtpHost"
                  value={formData.smtpHost || ""}
                  onChange={handleInputChange}
                  placeholder="smtp.provider.com"
                  autoComplete="off"
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-slate-900 text-sm font-bold focus:ring-2 focus:ring-[#c7f135]/20 focus:border-[#c7f135] outline-none transition-all placeholder:font-medium placeholder:text-slate-300"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  SMTP Port
                </label>
                <input
                  type="number"
                  name="smtpPort"
                  value={formData.smtpPort ?? ""}
                  onChange={handleInputChange}
                  placeholder="587"
                  min="1"
                  max="65535"
                  autoComplete="off"
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-slate-900 text-sm font-bold focus:ring-2 focus:ring-[#c7f135]/20 focus:border-[#c7f135] outline-none transition-all placeholder:font-medium placeholder:text-slate-300"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  Encryption
                </label>
                <select
                  name="smtpEncryption"
                  value={formData.smtpEncryption || "tls"}
                  onChange={handleInputChange}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-slate-900 text-sm font-bold focus:ring-2 focus:ring-[#c7f135]/20 focus:border-[#c7f135] outline-none transition-all"
                >
                  <option value="tls">TLS</option>
                  <option value="ssl">SSL</option>
                  <option value="none">None</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  SMTP Password
                </label>
                <div className="relative">
                  <input
                    type={showSmtpPassword ? "text" : "password"}
                    name="smtpAppPassword"
                    value={formData.smtpAppPassword || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        smtpAppPassword: value,
                      }));
                    }}
                    placeholder="16-character app password"
                    autoComplete="new-password"
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 pr-10 text-slate-900 text-sm font-bold focus:ring-2 focus:ring-[#c7f135]/20 focus:border-[#c7f135] outline-none transition-all placeholder:font-medium placeholder:text-slate-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSmtpPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={
                      showSmtpPassword
                        ? "Hide app password"
                        : "Show app password"
                    }
                  >
                    {showSmtpPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  {formData.hasSmtpPassword && !formData.smtpAppPassword ? (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                      Your password is saved
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-slate-400">
                      Store once. We keep it encrypted.
                    </span>
                  )}
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 font-medium mt-4">
              Your provider may require an app password or SMTP token.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm transition-all hover:shadow-md flex flex-col mt-6">
            <div className="flex items-center gap-2 mb-4 text-[#1b1b1b]">
              <Send className="w-5 h-5" />
              <h2 className="text-base font-bold text-slate-900">
                Send Test Email
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  Test Recipient Email
                </label>
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="test@example.com"
                  autoComplete="off"
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-slate-900 text-sm font-bold focus:ring-2 focus:ring-[#c7f135]/20 focus:border-[#c7f135] outline-none transition-all placeholder:font-medium placeholder:text-slate-300"
                />
              </div>

              <button
                type="button"
                onClick={handleSendTest}
                disabled={testing || saving || loading}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white px-4 py-3 rounded-xl font-bold shadow-lg shadow-slate-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Test
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default GmailSmtpSettings;
