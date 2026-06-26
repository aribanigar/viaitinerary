import React, { useState, useEffect } from "react";
import DashboardLayout from "./DashboardLayout";
import { Save, Loader2, CreditCard } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { fetchSettings, updateSettings, verifyIfsc } from "../../api/settings";
import Loader from "../common/Loader";
import { toast } from "react-toastify";

const PaymentDetails = () => {
  const { token } = useAuth();
  const [formData, setFormData] = useState({
    beneficiaryName: "",
    bankName: "",
    accountNumber: "",
    ifscCode: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ifscError, setIfscError] = useState("");
  const [ifscLoading, setIfscLoading] = useState(false);
  const [ifscData, setIfscData] = useState(null);

  const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await fetchSettings(token);
        if (data) {
          setFormData({
            beneficiaryName: data.beneficiaryName || "",
            bankName: data.bankName || "",
            accountNumber: data.accountNumber || "",
            ifscCode: data.ifscCode || "",
          });
        }
      } catch (err) {
        console.error("Failed to load payment details:", err);
      } finally {
        setLoading(false);
      }
    }
    if (token) loadSettings();
  }, [token]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const nextValue =
      name === "ifscCode" ? value.toUpperCase().replace(/\s/g, "") : value;
    setFormData((prev) => ({ ...prev, [name]: nextValue }));

    if (name === "ifscCode") {
      setIfscData(null);
      if (nextValue.trim() === "") {
        setIfscError("");
      } else if (!IFSC_REGEX.test(nextValue.trim())) {
        setIfscError("Enter a valid IFSC code (e.g., HDFC0ABC123).");
      } else {
        setIfscError("");
      }
    }
  };

  const handleVerifyIfsc = async () => {
    const trimmedIfsc = formData.ifscCode.trim();
    if (!trimmedIfsc || !IFSC_REGEX.test(trimmedIfsc)) {
      setIfscError("Enter a valid IFSC code (e.g., HDFC0ABC123).");
      return;
    }
    setIfscLoading(true);
    setIfscError("");
    setIfscData(null);
    try {
      const response = await verifyIfsc(token, trimmedIfsc);
      const data = response?.data || {};
      setIfscData({
        bank: data.bank,
        branch: data.branch,
        city: data.city,
        state: data.state,
        address: data.address,
        ifsc: data.ifsc,
      });
      setFormData((prev) => ({
        ...prev,
        bankName: data.bank || prev.bankName,
      }));
    } catch (err) {
      setIfscError(err?.message || "IFSC verification failed.");
    } finally {
      setIfscLoading(false);
    }
  };

  const handleSave = async () => {
    const trimmedIfsc = formData.ifscCode.trim();
    if (trimmedIfsc && !IFSC_REGEX.test(trimmedIfsc)) {
      setIfscError("Enter a valid IFSC code (e.g., HDFC0ABC123).");
      toast.error("Please fix the IFSC code before saving.");
      return;
    }
    if (trimmedIfsc && !ifscData) {
      toast.error("Please verify the IFSC code before saving.");
      return;
    }
    try {
      setSaving(true);
      // We pass the full settings object logic to the API,
      // but the API implementation for updateSettings usually handles partials or we can just send what we have
      // However, to be safe, we should probably fetch current settings first or send the whole thing.
      // Since the request said "don't do any change to backend", I'll assume the backend updateSettings
      // handles whatever we send it or we should send the full object to be safe.
      const currentSettings = await fetchSettings(token);
      const updatedSettings = {
        ...currentSettings,
        ...formData,
        ifscCode: formData.ifscCode.trim(),
      };
      await updateSettings(token, updatedSettings);
      toast.success("Payment details saved successfully!");
    } catch (err) {
      console.error("Save failed:", err);
      toast.error(err.message || "Failed to save payment details.");
    } finally {
      setSaving(false);
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader text="Loading your payment details..." />
        </div>
      );
    }

    return (
      <div className="max-w-5xl">
        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-2 mb-8 text-[#2563EB]">
            <CreditCard className="w-5 h-5" />
            <h2 className="text-lg font-bold text-slate-900">
              Bank Account Information
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1">
                Bank Name
              </label>
              <input
                type="text"
                name="bankName"
                value={formData.bankName}
                onChange={handleInputChange}
                placeholder="Enter bank name"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1">
                Beneficiary Name
              </label>
              <input
                type="text"
                name="beneficiaryName"
                value={formData.beneficiaryName}
                onChange={handleInputChange}
                placeholder="Enter beneficiary name"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1">
                Account Number
              </label>
              <input
                type="text"
                name="accountNumber"
                value={formData.accountNumber}
                onChange={handleInputChange}
                placeholder="Enter account number"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1">
                IFSC Code
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  name="ifscCode"
                  value={formData.ifscCode}
                  onChange={handleInputChange}
                  placeholder="Enter IFSC code"
                  maxLength={11}
                  className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-slate-900 font-bold outline-none transition-all ${
                    ifscData
                      ? "border-emerald-300 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      : ifscError
                        ? "border-red-300 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                        : "border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  }`}
                />
                <button
                  type="button"
                  onClick={handleVerifyIfsc}
                  disabled={ifscLoading || !formData.ifscCode}
                  className={`px-4 py-3 rounded-xl font-bold text-white transition-all ${
                    ifscLoading || !formData.ifscCode
                      ? "bg-slate-300 cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {ifscLoading ? "..." : "Verify"}
                </button>
              </div>
              {ifscError ? (
                <p className="text-xs font-semibold text-red-500">
                  {ifscError}
                </p>
              ) : null}
              {ifscData ? (
                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <p className="text-xs font-bold text-emerald-700">
                    Verified — {ifscData.bank}
                  </p>
                  <p className="text-xs font-semibold text-emerald-700">
                    {ifscData.branch} · {ifscData.city}, {ifscData.state}
                  </p>
                </div>
              ) : null}
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
            Payment Details
          </h1>
          <p className="text-slate-400 font-medium mt-1">
            Manage your bank account details for client payments.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={
            saving ||
            Boolean(ifscError) ||
            (formData.ifscCode.trim() && !ifscData)
          }
          className="w-full md:w-auto flex items-center justify-center gap-2 bg-[#2563EB] text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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

export default PaymentDetails;
