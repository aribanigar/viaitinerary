import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import PageHeader from "../components/common/PageHeader";
import { toast } from "react-toastify";
import { request } from "../utils/apiClient";
import { useAuth } from "../context/AuthContext";
import {
  Facebook,
  Chrome,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Zap,
  Loader2,
  Trash2,
} from "lucide-react";

const reasonLabelMap = {
  missing_required_fields: "Missing required fields",
  duplicate_lead: "Duplicate lead",
};

const requiredMetaColumns = [
  { field: "Full Name", column: "full_name", example: "Aarav Sharma" },
  { field: "Email", column: "email", example: "aarav@example.com" },
  { field: "Phone", column: "phone_number", example: "+91 9876543210" },
  {
    field: "Destination",
    column: "destination_to_visit?",
    example: "Bali, Indonesia",
  },
  {
    field: "Travel Date",
    column: "when_are_you_planning_to_travel?",
    example: "20-05-2026",
  },
  {
    field: "Number of Adults",
    column: "please_share_number_of_adults?",
    example: "2",
  },
  {
    field: "Number of Kids under 5",
    column: "please_share_number_of_kids_under_5?",
    example: "1",
  },
  {
    field: "Number of Nights",
    column: "please_share_number_of_nights_to_stay?",
    example: "5",
  },
];

const Integrations = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuth();

  const [integrations, setIntegrations] = useState({});
  const [loading, setLoading] = useState(true);
  const [metaSheetUrl, setMetaSheetUrl] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);
  const [isEditingMetaSheet, setIsEditingMetaSheet] = useState(false);

  const lastImportSummary =
    integrations?.facebook?.settings?.sheet_last_import_summary || null;

  const skipReasonCounts = lastImportSummary?.skip_reason_counts || {};
  const skippedRows = lastImportSummary?.skipped_rows || [];

  const skipReasonSummaryText = Object.entries(skipReasonCounts)
    .map(([key, count]) => `${reasonLabelMap[key] || key}: ${count}`)
    .join(" | ");

  const metaColumnsGuide = (
    <div className="mt-2 bg-white border border-slate-200 rounded-lg p-3 space-y-3">
      <div className="text-xs font-bold text-slate-700">
        Required Google Sheet columns
      </div>
      <div className="hidden md:grid md:grid-cols-3 gap-3 text-xs text-slate-600 pb-2 border-b border-slate-100">
        <div className="font-semibold text-slate-500">Field</div>
        <div className="font-semibold text-slate-500">Column name</div>
        <div className="font-semibold text-slate-500">Example</div>
      </div>
      <div className="space-y-3">
        {requiredMetaColumns.map((item) => (
          <div
            key={item.column}
            className="border border-slate-100 rounded p-2.5 md:border-0 md:p-0 md:grid md:grid-cols-3 md:gap-3 text-xs text-slate-700 md:items-center"
          >
            <div>
              <div className="font-semibold text-slate-500 text-[10px] md:hidden mb-1">
                Field
              </div>
              <div className="font-medium md:font-normal">{item.field}</div>
            </div>
            <div>
              <div className="font-semibold text-slate-500 text-[10px] md:hidden mb-1 mt-1.5">
                Column name
              </div>
              <div className="font-mono text-slate-900 bg-slate-50 px-2 py-1.5 rounded text-xs break-words">
                {item.column}
              </div>
            </div>
            <div>
              <div className="font-semibold text-slate-500 text-[10px] md:hidden mb-1 mt-1.5">
                Example
              </div>
              <div className="text-slate-500 italic">{item.example}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="text-xs text-slate-500 pt-2 border-t border-slate-100">
        <span className="font-semibold">Tip:</span> Keep column names in first
        row. Dates work best in dd-mm-yyyy format.
      </div>
    </div>
  );

  // Define fetchIntegrations using useCallback to be used in useEffect
  const fetchIntegrations = useCallback(async () => {
    if (!token) return;
    try {
      const response = await request("/integrations", {
        token: token,
      });
      setIntegrations(response || {});
    } catch (err) {
      console.error("Failed to fetch integrations", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const success = params.get("success");
    const error = params.get("error");
    const platform = params.get("platform");
    const normalizedPlatform = platform === "facebook" ? "meta" : platform;

    if (success) {
      toast.success(
        `${normalizedPlatform === "meta" ? "Meta" : "Google"} connected successfully!`,
      );
      // Clean up URL and refetch
      navigate("/integrations", { replace: true });
      fetchIntegrations();
    } else if (error) {
      toast.error(`Integration failed: ${decodeURIComponent(error)}`);
      // Clean up URL
      navigate("/integrations", { replace: true });
    }
  }, [location, navigate, fetchIntegrations]);

  useEffect(() => {
    const sheetUrl = integrations?.facebook?.settings?.sheet_url;
    if (sheetUrl) {
      setMetaSheetUrl(sheetUrl);
    }
  }, [integrations]);

  const saveMetaSettings = async () => {
    if (!metaSheetUrl.trim()) {
      toast.error("Please enter a Google Sheet URL");
      return;
    }

    setSavingMeta(true);
    try {
      const response = await request("/integrations/facebook/settings", {
        method: "PATCH",
        token,
        body: JSON.stringify({ sheet_url: metaSheetUrl.trim() }),
      });

      if (response?.sync_summary) {
        toast.success(
          `Meta sheet synced: ${response.sync_summary.imported} imported, ${response.sync_summary.skipped} skipped`,
        );

        const reasonText = Object.entries(
          response.sync_summary.skip_reason_counts || {},
        )
          .map(([key, count]) => `${reasonLabelMap[key] || key}: ${count}`)
          .join(" | ");

        if (reasonText) {
          toast.info(`Skipped reasons: ${reasonText}`);
        }
      } else {
        toast.success("Meta Google Sheet saved");
      }

      setIsEditingMetaSheet(false);
      fetchIntegrations();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save Meta settings");
    } finally {
      setSavingMeta(false);
    }
  };

  const handleDisconnect = async (platform) => {
    if (!window.confirm(`Are you sure you want to disconnect ${platform}?`))
      return;
    try {
      await request(
        `/integrations/${platform === "meta" ? "facebook" : "google"}`,
        {
          method: "DELETE",
          token: token,
        },
      );
      toast.info("Integration removed");
      fetchIntegrations();
    } catch (err) {
      toast.error("Failed to disconnect");
    }
  };

  const integrationPlatforms = [
    {
      id: "meta",
      db_key: "facebook",
      name: "Meta Ads",
      icon: Facebook,
      color: "#1877F2",
      description:
        "Auto-sync leads from Facebook Lead Ads and Instagram into your CRM.",
    },
    {
      id: "google",
      db_key: "google",
      name: "Google Ads",
      icon: Chrome,
      color: "#4285F4",
      description:
        "Import leads from Search & Youtube Lead Forms and sync conversions back.",
    },
  ];

  return (
    <DashboardLayout>
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-medium text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Inquiries
        </button>
      </div>

      <PageHeader
        title="Ads Integrations"
        description="Connect ad platforms and sync leads to your CRM."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        {loading ? (
          <div className="col-span-1 md:col-span-2 flex items-center justify-center p-20">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
          </div>
        ) : (
          integrationPlatforms.map((platform) => {
            const hasMetaSheet = !!integrations?.facebook?.settings?.sheet_url;
            const isConnected =
              platform.id === "meta"
                ? hasMetaSheet || !!integrations[platform.db_key]?.connected
                : !!integrations[platform.db_key]?.connected;
            return (
              <div
                key={platform.id}
                className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm transition-all duration-200"
              >
                <div className="flex justify-between items-start mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white"
                    style={{ backgroundColor: platform.color }}
                  >
                    <platform.icon className="w-6 h-6" />
                  </div>
                  <div
                    className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${
                      isConnected
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-slate-50 text-slate-400"
                    }`}
                  >
                    {isConnected ? "Connected" : "Disconnected"}
                  </div>
                </div>

                <h3 className="text-xl font-black text-slate-900 mb-2">
                  {platform.name}
                </h3>
                <p className="text-slate-500 text-sm font-medium leading-relaxed mb-5">
                  {platform.description}
                </p>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="flex flex-col gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div className="text-[11px] font-bold text-slate-900">
                      Real-time
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Lead sync {isConnected && "✓"}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div className="text-[11px] font-bold text-slate-900">
                      Secure
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Auth flow {isConnected && "✓"}
                    </div>
                  </div>
                </div>

                {isConnected ? (
                  <div className="space-y-3">
                    {platform.id === "meta" && (
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5">
                        <div className="text-[11px] font-black text-slate-900 mb-2">
                          Google Sheet URL
                        </div>
                        {hasMetaSheet && !isEditingMetaSheet ? (
                          <div className="space-y-2">
                            <div className="text-[11px] text-slate-500">
                              URL is hidden after save.
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setIsEditingMetaSheet(true)}
                                className="px-3 py-2 rounded-lg font-semibold text-xs text-slate-700 bg-white border border-slate-200 hover:bg-slate-100"
                              >
                                Edit URL
                              </button>
                              <button
                                onClick={saveMetaSettings}
                                disabled={savingMeta}
                                className="px-3 py-2 rounded-lg font-semibold text-xs text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                {savingMeta ? "Syncing..." : "Sync Leads"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <input
                              value={metaSheetUrl}
                              onChange={(e) => setMetaSheetUrl(e.target.value)}
                              placeholder="https://docs.google.com/spreadsheets/d/..."
                              className="flex-1 px-3 py-2.5 rounded-lg bg-white border border-slate-200 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#c7f135]"
                            />
                            <button
                              onClick={saveMetaSettings}
                              disabled={savingMeta}
                              className="px-3 py-2 rounded-lg font-semibold text-xs text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {savingMeta ? "Saving..." : "Save & Sync"}
                            </button>
                            {hasMetaSheet && (
                              <button
                                onClick={() => setIsEditingMetaSheet(false)}
                                disabled={savingMeta}
                                className="px-3 py-2 rounded-lg font-semibold text-xs text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        )}
                        <div className="text-[11px] text-slate-500 mt-2">
                          Public sheet required.
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          Last synced:{" "}
                          {integrations?.facebook?.settings
                            ?.sheet_last_synced_at || "Not yet"}
                        </div>
                        {lastImportSummary && (
                          <div className="text-[11px] text-slate-500 mt-1">
                            Last import: {lastImportSummary.imported} imported,{" "}
                            {lastImportSummary.skipped} skipped out of{" "}
                            {lastImportSummary.total}
                          </div>
                        )}
                        {skipReasonSummaryText && (
                          <div className="text-[11px] text-amber-700 mt-1">
                            {skipReasonSummaryText}
                          </div>
                        )}
                        {integrations?.facebook?.settings?.sheet_last_error && (
                          <div className="text-[11px] text-red-500 mt-1">
                            Last error:{" "}
                            {integrations.facebook.settings.sheet_last_error}
                          </div>
                        )}
                        {skippedRows.length > 0 && (
                          <div className="mt-2 bg-white border border-slate-200 rounded-lg p-2.5 space-y-1.5">
                            <div className="text-[11px] font-bold text-slate-700">
                              Skipped row details
                            </div>
                            {skippedRows.slice(0, 5).map((item, idx) => (
                              <div
                                key={`skip-row-${idx}`}
                                className="text-[11px] text-slate-600"
                              >
                                Row {item.row}:{" "}
                                {reasonLabelMap[item.reason] || item.reason}
                                {item.missing_fields?.length
                                  ? ` (${item.missing_fields.join(", ")})`
                                  : ""}
                              </div>
                            ))}
                          </div>
                        )}
                        {/* {metaColumnsGuide} */}
                      </div>
                    )}

                    <button
                      onClick={() => handleDisconnect(platform.id)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm text-red-600 bg-red-50 hover:bg-red-100 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                      Disconnect {platform.name.split(" ")[0]}
                    </button>
                  </div>
                ) : (
                  <>
                    {platform.id === "meta" ? (
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-2">
                        <div className="text-[11px] font-black text-slate-900">
                          Meta via Google Sheet
                        </div>
                        <input
                          value={metaSheetUrl}
                          onChange={(e) => setMetaSheetUrl(e.target.value)}
                          placeholder="https://docs.google.com/spreadsheets/d/..."
                          className="w-full px-3 py-2.5 rounded-lg bg-white border border-slate-200 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#c7f135]"
                        />
                        <button
                          onClick={saveMetaSettings}
                          disabled={savingMeta}
                          className="w-full px-4 py-2.5 rounded-lg font-bold text-sm text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {savingMeta ? "Saving..." : "Save & Sync Leads"}
                        </button>
                        {/* {metaColumnsGuide} */}
                      </div>
                    ) : (
                      <button
                        onClick={async () => {
                          try {
                            const response = await request(
                              `/auth/${platform.db_key}/redirect`,
                              {
                                token: token,
                              },
                            );
                            // The endpoint should return a redirect URL
                            if (response.url) {
                              window.location.href = response.url;
                            } else {
                              // Fallback if it actually redirects directly (though request() might catch it)
                              window.location.href = `https://viaitinerary.in/api/auth/${platform.db_key}/redirect?token=${token}`;
                            }
                          } catch (err) {
                            // Fallback: Use direct link with token if the request() wrapper behaves unexpectedly
                            window.location.href = `https://viaitinerary.in/api/auth/${platform.db_key}/redirect?token=${token}`;
                          }
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm text-white transition-all"
                        style={{ backgroundColor: platform.color }}
                      >
                        Continue with {platform.name.split(" ")[0]}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </DashboardLayout>
  );
};

export default Integrations;
