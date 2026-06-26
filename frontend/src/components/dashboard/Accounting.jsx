import React, { useEffect, useRef, useState } from "react";
import DashboardLayout from "./DashboardLayout";
import {
  FileCheck2,
  Hotel,
  Car,
  Receipt,
  FileText,
  Loader2,
  Save,
  Download,
  Send,
  MessageSquare,
  Mail,
  Image as ImageIcon,
  Upload,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import {
  fetchTrips,
  downloadConfirmationPdf,
  downloadPaymentVoucherPdf,
  downloadInvoicePdf,
  sendConfirmationEmail,
} from "../../api/trips";
import { fetchSettings, updateSettings } from "../../api/settings";
import Loader from "../common/Loader";
import Modal from "../common/Modal";
import DatePicker from "../common/DatePicker";
import {
  createAccountingSettlement,
  fetchAccountingTripLedger,
} from "../../api/accounting";

const DEFAULT_TEMPLATE_DATA = {
  confirmationMessage: "",
  confirmationPdfMessage: "",
  confirmationHeroImage: null,
  paymentVoucherEmailMessage: "",
  invoiceEmailMessage: "",
};

const TABS = [
  { id: "confirmation", label: "Confirmation Email", icon: FileCheck2 },
  { id: "hotel", label: "Hotel Email", icon: Hotel },
  { id: "cab", label: "Cab Email", icon: Car },
  { id: "paymentVoucher", label: "Payment Voucher", icon: Receipt },
  { id: "invoice", label: "Invoice", icon: FileText },
];

const FIELD_DEFS = {
  confirmation: [
    {
      key: "confirmationPdfMessage",
      label: "PDF Header Message",
      type: "textarea",
      placeholder: "Shown at top of confirmation PDF...",
      tags: ["{agencyName}", "{clientName}", "{tripId}"],
    },
    {
      key: "confirmationMessage",
      label: "Email / WhatsApp Message",
      type: "textarea",
      placeholder: "Body message used for confirmation sends...",
      tags: ["{agencyName}", "{clientName}", "{tripId}"],
    },
  ],
  hotel: [
    // Hotel template customization is temporarily disabled.
  ],
  cab: [
    // Cab template customization is temporarily disabled.
  ],
  paymentVoucher: [
    {
      key: "paymentVoucherEmailMessage",
      label: "Email / WhatsApp Message",
      type: "textarea",
      placeholder: "Body used when emailing payment voucher...",
      tags: [
        "{agencyName}",
        "{clientName}",
        "{tripId}",
        "{paymentAmount}",
        "{currencySymbol}",
      ],
    },
  ],
  invoice: [
    {
      key: "invoiceEmailMessage",
      label: "Email / WhatsApp Message",
      type: "textarea",
      placeholder: "Body used when emailing invoice...",
      tags: ["{agencyName}", "{clientName}", "{tripId}"],
    },
  ],
};

const parseCurrencySymbol = (currency) => {
  if (!currency || typeof currency !== "string") return "₹";
  const match = currency.match(/\((.*?)\)/);
  return match?.[1] || "₹";
};

const currencyValue = (symbol, value) => {
  const n = Number(value || 0);
  return `${symbol}${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
};

const normalizeWhatsappNumber = (value) =>
  String(value || "")
    .replace(/[^0-9]/g, "")
    .replace(/^00/, "");

const buildWhatsappUrl = (phoneNumber, message) => {
  const url = `https://wa.me/${phoneNumber}`;
  if (!message) return url;
  return `${url}?text=${encodeURIComponent(message)}`;
};

const Accounting = () => {
  const { token } = useAuth();
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [heroImageUploading, setHeroImageUploading] = useState(false);
  const [heroImageRemoving, setHeroImageRemoving] = useState(false);
  const [activeTab, setActiveTab] = useState("confirmation");
  const [fullSettings, setFullSettings] = useState(null);
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATE_DATA);
  const [trips, setTrips] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState("");
  const [actionLoadingKey, setActionLoadingKey] = useState("");
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptSaving, setReceiptSaving] = useState(false);
  const [receiptTripDetail, setReceiptTripDetail] = useState(null);
  const [receiptObligation, setReceiptObligation] = useState(null);
  const [receiptForm, setReceiptForm] = useState({
    amount: "",
    settlement_date: new Date().toISOString().slice(0, 10),
    method: "cash",
    notes: "",
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    async function bootstrap() {
      try {
        setLoading(true);
        const [settingsResp, tripsResp] = await Promise.all([
          fetchSettings(token),
          fetchTrips(token, { page: 1, per_page: 100 }),
        ]);

        const tripRows = Array.isArray(tripsResp?.data) ? tripsResp.data : [];
        setTrips(tripRows);
        if (tripRows.length > 0) {
          setSelectedTripId(tripRows[0].trip_id || tripRows[0].tripId || "");
        }

        setFullSettings(settingsResp || {});
        setTemplates({
          ...DEFAULT_TEMPLATE_DATA,
          ...(settingsResp || {}),
        });
      } catch (err) {
        toast.error(err.message || "Failed to load accounting settings");
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, [token]);

  const setField = (field, value) => {
    setTemplates((prev) => ({ ...prev, [field]: value }));
  };

  const insertTag = (field, tag) => {
    setTemplates((prev) => ({
      ...prev,
      [field]: `${prev[field] || ""}${tag}`,
    }));
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        setHeroImageUploading(true);
        const payload = {
          ...(fullSettings || {}),
          ...templates,
          confirmationHeroImage: reader.result,
        };
        const updated = await updateSettings(token, payload);
        setFullSettings(updated || payload);
        setTemplates((prev) => ({ ...prev, ...(updated || {}) }));
        toast.success("Hero image updated.");
      } catch (err) {
        toast.error(err.message || "Failed to update hero image.");
      } finally {
        setHeroImageUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const triggerHeroImagePicker = () => {
    if (heroImageUploading || heroImageRemoving) {
      return;
    }
    fileInputRef.current?.click();
  };

  const removeImage = async () => {
    if (!token) {
      toast.error("You must be logged in to update settings.");
      return;
    }

    try {
      setHeroImageRemoving(true);
      const payload = {
        ...(fullSettings || {}),
        ...templates,
        confirmationHeroImage: null,
      };
      const updated = await updateSettings(token, payload);
      setFullSettings(updated || payload);
      setTemplates((prev) => ({ ...prev, ...(updated || {}) }));
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      toast.success("Hero image removed.");
    } catch (err) {
      toast.error(err.message || "Failed to remove hero image.");
    } finally {
      setHeroImageRemoving(false);
    }
  };

  const saveTemplates = async () => {
    try {
      setSaving(true);
      const payload = {
        ...(fullSettings || {}),
        ...templates,
      };
      const updated = await updateSettings(token, payload);
      setFullSettings(updated || payload);
      setTemplates((prev) => ({ ...prev, ...(updated || {}) }));
      toast.success("Accounting templates saved successfully!");
    } catch (err) {
      toast.error(err.message || "Failed to save template settings");
    } finally {
      setSaving(false);
    }
  };

  const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(anchor);
  };

  const withAction = async (key, fn) => {
    try {
      setActionLoadingKey(key);
      await fn();
    } catch (err) {
      toast.error(err.message || "Action failed");
    } finally {
      setActionLoadingKey("");
    }
  };

  const handleTabAction = async (action) => {
    if (!selectedTripId) {
      toast.error("Please select a trip first");
      return;
    }

    if (action === "downloadConfirmation") {
      await withAction(action, async () => {
        const blob = await downloadConfirmationPdf(token, selectedTripId);
        downloadBlob(blob, `Trip_Confirmation_${selectedTripId}.pdf`);
        toast.success("Confirmation PDF downloaded");
      });
      return;
    }

    if (action === "sendClientWhatsapp") {
      const whatsappMessage = (templates.confirmationMessage || "")
        .replace(
          /{clientName}/g,
          selectedTrip?.client_name || selectedTrip?.clientName || "",
        )
        .replace(/{tripId}/g, selectedTripId);
      const phoneNumber = normalizeWhatsappNumber(
        selectedTrip?.client_phone || selectedTrip?.clientPhone || "",
      );
      if (!phoneNumber) {
        toast.error("Client phone number is missing or invalid.");
        return;
      }
      window.open(buildWhatsappUrl(phoneNumber, whatsappMessage), "_blank");
      return;
    }

    if (action === "sendClientEmail") {
      await withAction(action, async () => {
        const resp = await sendConfirmationEmail(
          token,
          selectedTripId,
          "client",
        );
        toast.success(resp?.message || "Confirmation email queued");
      });
      return;
    }

    if (action === "sendHotel") {
      await withAction(action, async () => {
        const resp = await sendConfirmationEmail(
          token,
          selectedTripId,
          "hotel",
        );
        toast.success(resp?.message || "Hotel email queued");
      });
      return;
    }

    if (action === "sendCab") {
      await withAction(action, async () => {
        const resp = await sendConfirmationEmail(token, selectedTripId, "cab");
        toast.success(resp?.message || "Cab email queued");
      });
      return;
    }

    if (action === "downloadVoucher") {
      await withAction(action, async () => {
        const blob = await downloadPaymentVoucherPdf(token, selectedTripId);
        downloadBlob(blob, `Payment_Voucher_${selectedTripId}.pdf`);
        toast.success("Payment voucher downloaded");
      });
      return;
    }

    if (action === "addReceipt") {
      await withAction(action, async () => {
        const detail = await fetchAccountingTripLedger(token, selectedTripId);
        const receivable = (detail?.obligations || []).find(
          (ob) => ob.direction === "receivable",
        );

        if (!receivable) {
          toast.error("No receivable obligation found for this trip.");
          return;
        }

        setReceiptTripDetail(detail || null);
        setReceiptObligation(receivable);
        setReceiptForm({
          amount: "",
          settlement_date: new Date().toISOString().slice(0, 10),
          method: "cash",
          notes: "",
        });
        setReceiptModalOpen(true);
      });
      return;
    }

    if (action === "sendVoucher") {
      await withAction(action, async () => {
        const resp = await sendConfirmationEmail(
          token,
          selectedTripId,
          "payment_voucher",
        );
        toast.success(resp?.message || "Payment voucher email sent");
      });
      return;
    }

    if (action === "sendVoucherWhatsapp") {
      const whatsappMessage = (templates.paymentVoucherEmailMessage || "")
        .replace(
          /{clientName}/g,
          selectedTrip?.client_name || selectedTrip?.clientName || "",
        )
        .replace(/{tripId}/g, selectedTripId);
      const phoneNumber = normalizeWhatsappNumber(
        selectedTrip?.client_phone || selectedTrip?.clientPhone || "",
      );
      if (!phoneNumber) {
        toast.error("Client phone number is missing or invalid.");
        return;
      }
      window.open(buildWhatsappUrl(phoneNumber, whatsappMessage), "_blank");
      return;
    }

    if (action === "downloadInvoice") {
      await withAction(action, async () => {
        const blob = await downloadInvoicePdf(token, selectedTripId);
        downloadBlob(blob, `Invoice_${selectedTripId}.pdf`);
        toast.success("Invoice downloaded");
      });
      return;
    }

    if (action === "sendInvoice") {
      await withAction(action, async () => {
        const resp = await sendConfirmationEmail(
          token,
          selectedTripId,
          "invoice",
        );
        toast.success(resp?.message || "Invoice email sent");
      });
      return;
    }

    if (action === "sendInvoiceWhatsapp") {
      const whatsappMessage = (templates.invoiceEmailMessage || "")
        .replace(
          /{clientName}/g,
          selectedTrip?.client_name || selectedTrip?.clientName || "",
        )
        .replace(/{tripId}/g, selectedTripId);
      const phoneNumber = normalizeWhatsappNumber(
        selectedTrip?.client_phone || selectedTrip?.clientPhone || "",
      );
      if (!phoneNumber) {
        toast.error("Client phone number is missing or invalid.");
        return;
      }
      window.open(buildWhatsappUrl(phoneNumber, whatsappMessage), "_blank");
    }
  };

  const closeReceiptModal = () => {
    setReceiptModalOpen(false);
    setReceiptObligation(null);
  };

  const handleSaveReceipt = async () => {
    if (!receiptObligation) return;

    const remaining =
      Number(receiptObligation.expected_amount || 0) -
      Number(receiptObligation.settled_amount || 0);
    const amount = Number(receiptForm.amount || 0);

    if (!amount || amount <= 0) {
      toast.error("Amount must be greater than 0.");
      return;
    }

    if (amount > remaining + 0.01) {
      toast.error(
        `Amount cannot exceed the due amount of ${remaining.toLocaleString()}.`,
      );
      return;
    }

    try {
      setReceiptSaving(true);
      const payload = {
        obligation_id: receiptObligation.id,
        amount,
        settlement_type: "receipt",
        settlement_date: receiptForm.settlement_date,
        method: receiptForm.method || null,
        notes: receiptForm.notes || null,
      };
      await createAccountingSettlement(token, payload);
      toast.success("Receipt added.");
      closeReceiptModal();
    } catch (err) {
      toast.error(err.message || "Failed to save receipt.");
    } finally {
      setReceiptSaving(false);
    }
  };

  const actionsByTab = {
    confirmation: [
      { id: "downloadConfirmation", label: "Generate PDF", icon: Download },
      {
        id: "sendClientEmail",
        label: "Send Email To Client",
        icon: Mail,
      },
      {
        id: "sendClientWhatsapp",
        label: "Send WhatsApp To Client",
        icon: MessageSquare,
      },
    ],
    hotel: [{ id: "sendHotel", label: "Send Hotel Email", icon: Send }],
    cab: [{ id: "sendCab", label: "Send Cab Email", icon: Send }],
    paymentVoucher: [
      { id: "downloadVoucher", label: "Generate PDF", icon: Download },
      { id: "sendVoucher", label: "Send Email To Client", icon: Send },
      {
        id: "sendVoucherWhatsapp",
        label: "Send WhatsApp To Client",
        icon: MessageSquare,
      },
      { id: "addReceipt", label: "Add Receipt", icon: Receipt },
    ],
    invoice: [
      { id: "downloadInvoice", label: "Generate PDF", icon: Download },
      { id: "sendInvoice", label: "Send Email To Client", icon: Send },
      {
        id: "sendInvoiceWhatsapp",
        label: "Send WhatsApp To Client",
        icon: MessageSquare,
      },
    ],
  };

  const isTemplateEditingDisabled =
    activeTab === "hotel" || activeTab === "cab";

  const filteredTrips = trips.filter((trip) => {
    const tripId = String(trip.trip_id || trip.tripId || "").toLowerCase();
    const title = String(trip.trip_title || trip.tripTitle || "").toLowerCase();
    const client = String(
      trip.client_name || trip.clientName || "",
    ).toLowerCase();
    const query = searchQuery.toLowerCase();
    return (
      tripId.includes(query) || title.includes(query) || client.includes(query)
    );
  });

  const selectedTrip = trips.find(
    (t) => String(t.trip_id || t.tripId) === String(selectedTripId),
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-[50vh] flex items-center justify-center">
          <Loader text="Loading accounting templates..." />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-10">
        <h1 className="text-3xl font-black text-slate-900 leading-tight">
          Voucher Desk
        </h1>
        <p className="text-slate-400 font-medium mt-1">
          Manage tab-wise email/PDF templates and send documents directly from
          one place.
        </p>
      </div>

      <div className="max-w-6xl">
        <div className="flex overflow-x-auto pb-4 mb-6 gap-2 hide-scrollbar">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? "bg-slate-900 text-white shadow-md shadow-slate-200"
                  : "bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 border border-slate-200"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-12">
          {(!isTemplateEditingDisabled || activeTab === "confirmation") && (
            <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
              {activeTab === "confirmation" && (
                <div className="space-y-4 p-4 bg-slate-50 border border-slate-100 rounded-xl">
                  <div className="flex items-center gap-2 text-slate-700">
                    <ImageIcon className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Confirmation Hero Image
                    </span>
                  </div>

                  <div
                    className={`relative w-full md:w-72 aspect-video bg-white border-2 border-dashed border-slate-200 rounded-xl overflow-hidden group flex items-center justify-center ${
                      templates.confirmationHeroImage
                        ? "cursor-pointer"
                        : "cursor-default"
                    }`}
                    onClick={() =>
                      templates.confirmationHeroImage
                        ? triggerHeroImagePicker()
                        : undefined
                    }
                  >
                    {templates.confirmationHeroImage ? (
                      <>
                        <img
                          src={templates.confirmationHeroImage}
                          alt="Hero preview"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 border border-white rounded-full">
                            Change Image
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="text-center p-4 text-slate-400 text-xs font-bold uppercase tracking-wider">
                        No image selected
                      </div>
                    )}
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageChange}
                    accept=".jpg,.jpeg,.png,.webp"
                    className="hidden"
                  />
                  <div className="flex items-center gap-4">
                    {!templates.confirmationHeroImage && (
                      <button
                        onClick={triggerHeroImagePicker}
                        disabled={heroImageUploading}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-50"
                      >
                        {heroImageUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        {heroImageUploading ? "Uploading..." : "Upload Image"}
                      </button>
                    )}
                    {templates.confirmationHeroImage && (
                      <button
                        type="button"
                        onClick={removeImage}
                        disabled={heroImageRemoving}
                        className="text-[10px] font-black uppercase tracking-widest text-rose-600 hover:text-rose-700 disabled:opacity-50"
                      >
                        {heroImageRemoving ? "Removing..." : "Remove"}
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium mt-2">
                    Accepted formats: JPG, JPEG, PNG, WebP
                  </p>
                </div>
              )}

              {(FIELD_DEFS[activeTab] || []).map((field) => (
                <div key={field.key} className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1">
                    {field.label}
                  </label>

                  {field.type === "textarea" ? (
                    <textarea
                      value={templates[field.key] || ""}
                      onChange={(e) => setField(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full min-h-36 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  ) : (
                    <input
                      value={templates[field.key] || ""}
                      onChange={(e) => setField(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  )}

                  <div className="flex flex-wrap gap-2">
                    {(field.tags || []).map((tag) => (
                      <button
                        key={`${field.key}-${tag}`}
                        onClick={() => insertTag(field.key, tag)}
                        className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-md text-[10px] font-bold"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div className="pt-4 border-t border-slate-100">
                {!isTemplateEditingDisabled && (
                  <button
                    onClick={saveTemplates}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-60"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save Template
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="lg:col-span-1 border border-slate-200 shadow-sm rounded-xl p-6 bg-white space-y-4 h-fit">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                Target Trip
              </p>
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 text-left flex justify-between items-center focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                >
                  <span className="truncate">
                    {selectedTrip ? (
                      `${selectedTrip.trip_id || selectedTrip.tripId} - ${
                        selectedTrip.trip_title || selectedTrip.tripTitle
                      } (${selectedTrip.client_name || selectedTrip.clientName})`
                    ) : (
                      <span className="text-slate-400">Select a trip...</span>
                    )}
                  </span>
                  <div className="flex items-center gap-1.5 ml-2">
                    {selectedTripId && (
                      <X
                        className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTripId("");
                        }}
                      />
                    )}
                    <div className="w-px h-4 bg-slate-200 mx-0.5" />
                    <svg
                      className={`w-4 h-4 text-slate-400 transition-transform ${
                        isDropdownOpen ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </button>

                {isDropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-100">
                    <div className="p-2 border-b border-slate-100">
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg
                            className="h-4 w-4 text-slate-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                          </svg>
                        </div>
                        <input
                          type="text"
                          className="block w-full pl-9 pr-3 py-2 border border-slate-100 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all"
                          placeholder="Search ID, title, or client..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
                      {filteredTrips.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-slate-500 text-center">
                          No matching trips
                        </div>
                      ) : (
                        filteredTrips.map((trip) => {
                          const tripId = trip.trip_id || trip.tripId;
                          const isSelected = selectedTripId === tripId;
                          return (
                            <button
                              key={tripId}
                              type="button"
                              onClick={() => {
                                setSelectedTripId(tripId);
                                setIsDropdownOpen(false);
                                setSearchQuery("");
                              }}
                              className={`w-full px-3 py-2.5 rounded-lg text-sm text-left flex flex-col gap-0.5 transition-colors ${
                                isSelected
                                  ? "bg-slate-900 text-white"
                                  : "hover:bg-slate-50 text-slate-700"
                              }`}
                            >
                              <div className="flex justify-between items-center">
                                <span className="font-bold">{tripId}</span>
                                {isSelected && (
                                  <FileCheck2 className="w-3.5 h-3.5" />
                                )}
                              </div>
                              <span
                                className={`truncate text-xs ${
                                  isSelected
                                    ? "text-slate-300"
                                    : "text-slate-500"
                                }`}
                              >
                                {trip.trip_title || trip.tripTitle} (
                                {trip.client_name || trip.clientName})
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2 pt-2">
              {(actionsByTab[activeTab] || []).map((action) => (
                <button
                  key={action.id}
                  onClick={() => handleTabAction(action.id)}
                  disabled={!selectedTripId || actionLoadingKey === action.id}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 disabled:opacity-50"
                >
                  {actionLoadingKey === action.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <action.icon className="w-4 h-4" />
                  )}
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={receiptModalOpen}
        onClose={closeReceiptModal}
        title="Receivable Receipt"
        submitting={receiptSaving}
        submitButtonText="Make Receipt"
        onSubmit={handleSaveReceipt}
      >
        <div className="space-y-4">
          {receiptObligation && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4">
              <div className="flex justify-between items-center text-xs text-blue-800 font-bold uppercase tracking-wider">
                <span>Due Amount:</span>
                <span>
                  {currencyValue(
                    parseCurrencySymbol(receiptTripDetail?.currency),
                    Number(receiptObligation.expected_amount || 0) -
                      Number(receiptObligation.settled_amount || 0),
                  )}
                </span>
              </div>
            </div>
          )}

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
              Amount
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={receiptForm.amount}
              onChange={(e) =>
                setReceiptForm((prev) => ({
                  ...prev,
                  amount: e.target.value,
                }))
              }
              className="mt-1 w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
              Settlement Type
            </label>
            <select
              value="receipt"
              disabled
              className="mt-1 w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-600 focus:outline-none"
            >
              <option value="receipt">Receipt (Got from Client)</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
              Date
            </label>
            <DatePicker
              value={receiptForm.settlement_date}
              onChange={(val) =>
                setReceiptForm((prev) => ({
                  ...prev,
                  settlement_date: val || "",
                }))
              }
              className="w-full"
              options={{
                dateFormat: "d-m-Y",
              }}
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
              Payment Method
            </label>
            <select
              value={receiptForm.method}
              onChange={(e) =>
                setReceiptForm((prev) => ({
                  ...prev,
                  method: e.target.value,
                }))
              }
              className="mt-1 w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            >
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="upi">UPI / GPay / PhonePe</option>
              <option value="card">Credit/Debit Card</option>
              <option value="cheque">Cheque</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
              Notes (Optional)
            </label>
            <textarea
              value={receiptForm.notes}
              onChange={(e) =>
                setReceiptForm((prev) => ({
                  ...prev,
                  notes: e.target.value,
                }))
              }
              rows={3}
              className="mt-1 w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-300 shadow-sm"
              placeholder="Description for this receipt..."
            />
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
};

export default Accounting;
