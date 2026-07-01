import React, { useState, useEffect } from "react";
import DashboardLayout from "./DashboardLayout";
import { PhoneInput } from "react-international-phone";
import "react-international-phone/style.css";
import {
  Save,
  Image as ImageIcon,
  Building,
  MapPin,
  Phone,
  Globe,
  Mail,
  MessageCircle,
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  Loader2,
  Upload,
  FileSpreadsheet,
  Download,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  fetchSettings,
  updateSettings,
  bulkImport,
  downloadBulkTemplate,
  bulkExport,
} from "../../api/settings";
import Loader from "../common/Loader";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";

const AgencySettings = () => {
  const { token } = useAuth();
  const [formData, setFormData] = useState({
    agencyName: "TravelAgency",
    phone: "+1 234 567 890",
    website: "www.youragency.com",
    companyAddress: "",
    email: "contact@agency.com",
    whatsapp: "+1 234 567 890",
    brandColor: "#F4A229",
    secondaryColor: "#0D2D2D",
    logo: null,
    beneficiaryName: "",
    bankName: "",
    accountNumber: "",
    ifscCode: "",
    gstAmount: 5,
    profitMarginPercentage: 10,
    defaultTripImage: null,
    greetingMessage:
      "Greetings from {agencyName}. Our team has put up this Quote regarding your upcoming trip. Please review it and let us know if you would like any changes.",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingLogo, setRemovingLogo] = useState(false);
  const [removingDefaultCover, setRemovingDefaultCover] = useState(false);
  const [importing, setImporting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await fetchSettings(token);
        if (data) {
          setFormData((prev) => ({ ...prev, ...data }));
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

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, logo: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDefaultTripImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, defaultTripImage: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBulkImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setImporting(true);
      await bulkImport(token, file);
      toast.success("Bulk data imported successfully!");
      // Reset the file input
      e.target.value = "";
    } catch (err) {
      console.error("Import failed:", err);
      toast.error(err.message || "Failed to import bulk data.");
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      setDownloading(true);

      // Create a new workbook
      const wb = XLSX.utils.book_new();

      // Sheet 1: Transportation
      const transportationData = [
        ["Car Name", "Vehicle Email", "Vehicle Phone", "Price (INR)"],
        ["Sedan (Dzire/Etios)", "driver@example.com", "9876543210", 2500],
        ["SUV (Innova/Xylo)", "innova@example.com", "9876543211", 3500],
        ["Tempo Traveler", "tempo@example.com", "9876543212", 5500],
      ];
      const wsTrans = XLSX.utils.aoa_to_sheet(transportationData);
      XLSX.utils.book_append_sheet(wb, wsTrans, "Transportation");

      // Sheet 2: Accommodation
      const accommodationData = [
        [
          "Hotel Name",
          "City",
          "Hotel Email",
          "Hotel Phone",
          "Price Sections (JSON)",
        ],
        [
          "Grand Plaza Hotel",
          "Paris",
          "grand@example.com",
          "9876543220",
          '[{"room_type":"deluxe","meal_plan":"room_only","price":4500,"cnb":500,"upto_5":1500,"above_12":2000},{"room_type":"super_deluxe","meal_plan":"room_only","price":5500,"cnb":800,"upto_5":1800,"above_12":2500}]',
        ],
        [
          "Riverside Inn",
          "Rome",
          "pine@example.com",
          "9876543221",
          '[{"room_type":"deluxe","meal_plan":"room_only","price":6500,"cnb":800,"upto_5":2000,"above_12":2500},{"room_type":"suite","meal_plan":"room_only","price":12000,"cnb":1500,"upto_5":3500,"above_12":4500}]',
        ],
      ];
      const wsAcc = XLSX.utils.aoa_to_sheet(accommodationData);
      XLSX.utils.book_append_sheet(wb, wsAcc, "Accommodation");

      // Sheet 3: Destinations
      const destinationsData = [
        ["Destination Name", "Activities"],
        [
          "Paris",
          "City Sightseeing Tour, Local Museum, Historic Landmark",
        ],
        ["Rome", "Old Town Walk, Riverside Promenade, Local Market"],
        ["Bali", "Cable Car Ride, Hiking Trail, Local Cuisine Tour"],
      ];
      const wsDest = XLSX.utils.aoa_to_sheet(destinationsData);
      XLSX.utils.book_append_sheet(wb, wsDest, "Destinations");

      // Export the file
      XLSX.writeFile(wb, "bulk_import_template.xlsx");

      toast.success("Template downloaded successfully!");
    } catch (err) {
      console.error("Download failed:", err);
      toast.error("Failed to generate template. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const handleBulkExport = async () => {
    try {
      setExporting(true);
      const blob = await bulkExport(token);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "agency_data_export.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Data exported successfully!");
    } catch (err) {
      console.error("Export failed:", err);
      toast.error("Failed to export data. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const handleSave = async () => {
    if (!formData.phone || formData.phone.length < 5) {
      toast.error("Phone number is required");
      return;
    }
    if (!formData.whatsapp || formData.whatsapp.length < 5) {
      toast.error("WhatsApp number is required");
      return;
    }

    try {
      setSaving(true);
      await updateSettings(token, formData);
      toast.success("Settings saved successfully!");
    } catch (err) {
      console.error("Save failed:", err);
      toast.error(err.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!token) {
      toast.error("You must be logged in to update settings.");
      return;
    }

    try {
      setRemovingLogo(true);
      const updated = { ...formData, logo: null };
      await updateSettings(token, updated);
      setFormData((prev) => ({ ...prev, logo: null }));
      toast.success("Logo removed successfully!");
    } catch (err) {
      console.error("Remove logo failed:", err);
      toast.error(err.message || "Failed to remove logo.");
    } finally {
      setRemovingLogo(false);
    }
  };

  const handleRemoveDefaultCover = async () => {
    if (!token) {
      toast.error("You must be logged in to update settings.");
      return;
    }

    try {
      setRemovingDefaultCover(true);
      const updated = { ...formData, defaultTripImage: null };
      await updateSettings(token, updated);
      setFormData((prev) => ({ ...prev, defaultTripImage: null }));
      toast.success("Default cover removed successfully!");
    } catch (err) {
      console.error("Remove default cover failed:", err);
      toast.error(err.message || "Failed to remove default cover.");
    } finally {
      setRemovingDefaultCover(false);
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader text="Loading your agency settings..." />
        </div>
      );
    }

    return (
      <div className="pb-12">
        <div className="max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 transition-all duration-500 ease-in-out items-stretch">
            <div className="lg:col-span-1 flex flex-col gap-6">
              <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm transition-all hover:shadow-md flex flex-col">
                <div className="flex items-center gap-2 mb-6 text-[#1b1b1b]">
                  <ImageIcon className="w-5 h-5" />
                  <h2 className="text-base font-bold text-slate-900">
                    Company Logo
                  </h2>
                </div>

                <div
                  className="border-2 border-dashed border-slate-100 rounded-xl flex flex-col items-center justify-center p-4 mb-4 relative overflow-hidden group hover:border-[#1b1b1b] transition-all cursor-pointer"
                  onClick={() => document.getElementById("logoInput").click()}
                >
                  {formData.logo ? (
                    <img
                      src={formData.logo}
                      alt="Company Logo"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <>
                      <ImageIcon className="w-10 h-10 text-slate-200 mb-4 group-hover:scale-110 transition-transform duration-500" />
                      <p className="text-xs font-bold text-slate-400">
                        Click to Upload Logo
                      </p>
                    </>
                  )}
                  <input
                    type="file"
                    id="logoInput"
                    className="hidden"
                    accept=".jpg,.jpeg,.png,.webp"
                    onChange={handleLogoChange}
                  />
                  {formData.logo && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 border border-white rounded-full">
                        Change Logo
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                      Upload your logo image.
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium mt-1">
                      Accepted formats: JPG, JPEG, PNG, WebP
                    </p>
                  </div>
                  {formData.logo && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      disabled={removingLogo}
                      className="text-[10px] font-black uppercase tracking-widest text-rose-600 hover:text-rose-700 disabled:opacity-50"
                    >
                      {removingLogo ? "Removing..." : "Remove"}
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm transition-all hover:shadow-md flex flex-col">
                <div className="flex items-center gap-2 mb-6 text-[#1b1b1b]">
                  <ImageIcon className="w-5 h-5" />
                  <h2 className="text-base font-bold text-slate-900">
                    Default Itinerary Cover
                  </h2>
                </div>

                <div
                  className="border-2 border-dashed border-slate-100 rounded-xl flex flex-col items-center justify-center p-4 mb-4 relative overflow-hidden group hover:border-[#1b1b1b] transition-all cursor-pointer"
                  onClick={() =>
                    document.getElementById("defaultTripImageInput").click()
                  }
                >
                  {formData.defaultTripImage ? (
                    <img
                      src={formData.defaultTripImage}
                      alt="Default itinerary cover"
                      className="w-full h-full object-cover rounded-xl"
                    />
                  ) : (
                    <>
                      <ImageIcon className="w-10 h-10 text-slate-200 mb-4 group-hover:scale-110 transition-transform duration-500" />
                      <p className="text-xs font-bold text-slate-400 text-center">
                        Click to Upload
                        <br />
                        Default Cover
                      </p>
                    </>
                  )}
                  <input
                    type="file"
                    id="defaultTripImageInput"
                    className="hidden"
                    accept=".jpg,.jpeg,.png,.webp"
                    onChange={handleDefaultTripImageChange}
                  />
                  {formData.defaultTripImage && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 border border-white rounded-full">
                        Change Cover
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                      Used by default in Trip Builder.
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium mt-1">
                      Accepted formats: JPG, JPEG, PNG, WebP
                    </p>
                  </div>
                  {formData.defaultTripImage && (
                    <button
                      type="button"
                      onClick={handleRemoveDefaultCover}
                      disabled={removingDefaultCover}
                      className="text-[10px] font-black uppercase tracking-widest text-rose-600 hover:text-rose-700 disabled:opacity-50"
                    >
                      {removingDefaultCover ? "Removing..." : "Remove"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Agency Details */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm transition-all hover:shadow-md flex flex-col flex-1">
                <div className="flex items-center gap-2 mb-8 text-[#1b1b1b]">
                  <Building className="w-5 h-5" />
                  <h2 className="text-base font-bold text-slate-900">
                    Agency Details
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
                  {/* Agency Name */}
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1">
                      Agency Name
                    </label>
                    <input
                      type="text"
                      name="agencyName"
                      value={formData.agencyName}
                      onChange={handleInputChange}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-slate-900 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:font-medium placeholder:text-slate-300"
                    />
                  </div>

                  {/* Phone and Website */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1.5">
                      <Phone className="w-3 h-3" />
                      Phone <span className="text-rose-500">*</span>
                    </label>
                    <div className="phone-input-container">
                      <PhoneInput
                        defaultCountry="in"
                        value={formData.phone}
                        onChange={(phone) =>
                          setFormData({ ...formData, phone })
                        }
                        className="w-full"
                        inputClassName="!w-full !bg-slate-50 !border-slate-100 !rounded-xl !px-4 !py-6 !text-slate-900 !text-sm !font-bold !focus:ring-2 !focus:ring-blue-500/20 !focus:border-blue-500 !outline-none !transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1.5">
                      <Globe className="w-3 h-3" />
                      Website
                    </label>
                    <input
                      type="text"
                      name="website"
                      value={formData.website}
                      onChange={handleInputChange}
                      placeholder="e.g. www.travellagency.com"
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-slate-900 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:font-medium placeholder:text-slate-300"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1.5">
                      <MapPin className="w-3 h-3" />
                      Company Address{" "}
                      <span className="text-slate-300">(Optional)</span>
                    </label>
                    <textarea
                      name="companyAddress"
                      value={formData.companyAddress || ""}
                      onChange={handleInputChange}
                      placeholder="e.g. 2nd Floor, Main Street, Your City, Country"
                      rows={2}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-slate-900 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:font-medium placeholder:text-slate-300 resize-y"
                    />
                  </div>

                  {/* Email and WhatsApp */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1.5">
                      <Mail className="w-3 h-3" />
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="e.g. contact@agency.com"
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-slate-900 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:font-medium placeholder:text-slate-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1.5">
                      <MessageCircle className="w-3 h-3" />
                      WhatsApp <span className="text-rose-500">*</span>
                    </label>
                    <div className="phone-input-container">
                      <PhoneInput
                        defaultCountry="in"
                        value={formData.whatsapp}
                        onChange={(phone) =>
                          setFormData({ ...formData, whatsapp: phone })
                        }
                        className="w-full"
                        inputClassName="!w-full !bg-slate-50 !border-slate-100 !rounded-xl !px-4 !py-6 !text-slate-900 !text-sm !font-bold !focus:ring-2 !focus:ring-blue-500/20 !focus:border-blue-500 !outline-none !transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bulk Data Management Section - Moved here for more width */}
              <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm transition-all hover:shadow-md flex flex-col flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                  <div className="flex items-center gap-2 text-[#1b1b1b]">
                    <FileSpreadsheet className="w-5 h-5" />
                    <h2 className="text-base font-bold text-slate-900">
                      Bulk Data Management
                    </h2>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleDownloadTemplate}
                      disabled={downloading}
                      className="text-[10px] font-black uppercase tracking-widest text-[#1b1b1b] bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                      {downloading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Download className="w-3 h-3" />
                      )}
                      Sample Template
                    </button>
                    <button
                      onClick={handleBulkExport}
                      disabled={exporting}
                      className="text-[10px] font-black uppercase tracking-widest text-slate-600 bg-slate-50 hover:bg-slate-100 px-4 py-2 rounded-lg flex items-center gap-2 transition-all disabled:opacity-50 border border-slate-100"
                    >
                      {exporting ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Download className="w-3 h-3" />
                      )}
                      Export Data
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 mb-1">
                        Import Data
                      </h3>
                      <p className="text-xs text-slate-400 font-medium leading-relaxed">
                        Upload an Excel file (.xlsx) with sheets for{" "}
                        <b>Transportation</b>, <b>Accommodation</b>, and{" "}
                        <b>Destinations</b> to bulk import your agency's master
                        data.
                      </p>
                    </div>

                    <div className="relative">
                      <input
                        type="file"
                        id="bulkImportInput"
                        className="hidden"
                        accept=".xlsx, .xls"
                        onChange={handleBulkImport}
                        disabled={importing}
                      />
                      <button
                        onClick={() =>
                          document.getElementById("bulkImportInput").click()
                        }
                        disabled={importing}
                        className="w-full flex flex-col items-center justify-center gap-2 bg-slate-50/50 hover:bg-blue-50/50 border-2 border-dashed border-slate-100 hover:border-[#1b1b1b] text-slate-300 hover:text-[#1b1b1b] py-8 rounded-xl transition-all group"
                      >
                        {importing ? (
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 className="w-8 h-8 animate-spin text-[#1b1b1b]" />
                            <span className="text-xs font-bold text-[#1b1b1b]">
                              Processing File...
                            </span>
                          </div>
                        ) : (
                          <>
                            <Upload className="w-8 h-8 mb-1 group-hover:scale-110 transition-transform" />
                            <span className="text-xs font-bold">
                              Click to upload or drag & drop
                            </span>
                            <span className="text-[10px] font-medium opacity-60">
                              Support .xlsx, .xls (Max 10MB)
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-50/50 rounded-xl p-6 border border-slate-100">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 block">
                      Instructions & Sheet Structure
                    </h3>
                    <div className="space-y-5">
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 shrink-0 flex items-center justify-center text-[11px] font-bold text-[#1b1b1b]">
                          01
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-700">
                            Transportation
                          </p>
                          <p className="text-[10px] font-medium text-slate-500">
                            Car Name, Vehicle Email, Vehicle Phone, Price (INR)
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 shrink-0 flex items-center justify-center text-[11px] font-bold text-[#1b1b1b]">
                          02
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-700">
                            Accommodation
                          </p>
                          <p className="text-[10px] font-medium text-slate-500 leading-tight">
                            Hotel Name, City, Hotel Email, Hotel Phone, Price
                            Sections (JSON)
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 shrink-0 flex items-center justify-center text-[11px] font-bold text-[#1b1b1b]">
                          03
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-700">
                            Destinations
                          </p>
                          <p className="text-[10px] font-medium text-slate-500">
                            Destination Name, Activities (comma separated)
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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
            Agency Settings
          </h1>
          <p className="text-slate-400 font-medium mt-1">
            Manage your default branding and contact details for all
            itineraries.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={loading || saving}
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

export default AgencySettings;
