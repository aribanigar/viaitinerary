import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DashboardLayout from "./DashboardLayout";
import { formatDate } from "../../utils/dateUtils";
import {
  Mail,
  Phone,
  Calendar,
  Users,
  Trash2,
  Search,
  Loader2,
  Inbox,
  Code,
  Plus,
  Share2,
  Upload,
  Download,
  AlertCircle,
  ChevronRight,
  UserCheck,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  getLeadInquiries,
  getLeadAssignableMembers,
  deleteLeadInquiry,
  importLeadInquiries,
} from "../../api/leadInquiries";
import { fetchSettings } from "../../api/settings";
import { toast } from "react-toastify";
import PageHeader from "../common/PageHeader";
import CompactDataTable from "../common/CompactDataTable";
import LeadDrawer, { WhatsAppGlyph } from "./leads/LeadDrawer";
import {
  STAGES,
  stageOf,
  isOpenStage,
  SOURCES,
  sourceLabel,
  PRIORITIES,
  priorityOf,
  followUpBadge,
  timeAgo,
  waNumber,
} from "../../utils/leads";
import * as XLSX from "xlsx";

const TABS = [
  { key: "open", label: "Open" },
  ...STAGES.map((s) => ({ key: s.key, label: s.label })),
  { key: "all", label: "All" },
];

const LeadInquiries = () => {
  const { token, user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [inquiries, setInquiries] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(params.get("status") || "open");
  const [followFilter, setFollowFilter] = useState(params.get("follow_up") || "");
  const [sourceFilter, setSourceFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [mine, setMine] = useState(user?.role === "team");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [assignableMembers, setAssignableMembers] = useState([]);
  const [agencyName, setAgencyName] = useState("");
  const [importing, setImporting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [tablePage, setTablePage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [drawer, setDrawer] = useState(() => (params.get("lead") ? { id: Number(params.get("lead")), wa: false } : null));
  const [pagination, setPagination] = useState({
    currentPage: 1,
    lastPage: 1,
    total: 0,
    from: 0,
    to: 0,
    perPage: 25,
  });
  const requestSeq = useRef(0);

  // Typing in search waits for a pause instead of a request per key.
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setTablePage(1);
  }, [statusFilter, followFilter, sourceFilter, priorityFilter, mine, searchTerm, pageSize]);

  const fetchInquiries = useCallback(
    async (page = 1, { quiet = false } = {}) => {
      const seq = ++requestSeq.current;
      if (!quiet) setLoading(true);
      try {
        const response = await getLeadInquiries(token, {
          status: statusFilter,
          follow_up: followFilter || undefined,
          source: sourceFilter || undefined,
          priority: priorityFilter || undefined,
          mine,
          sort: followFilter ? "follow_up" : undefined,
          search: searchTerm || undefined,
          page,
          per_page: pageSize,
        });
        if (seq !== requestSeq.current) return; // a newer filter already answered
        setInquiries(response.data || []);
        setCounts(response.counts || {});
        setPagination({
          currentPage: response.current_page ?? page,
          lastPage: response.last_page ?? 1,
          total: response.total ?? 0,
          from: response.from ?? 0,
          to: response.to ?? 0,
          perPage: response.per_page ?? pageSize,
        });
      } catch (error) {
        if (seq !== requestSeq.current) return;
        console.error("Error fetching inquiries:", error);
        toast.error("Failed to load leads");
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    },
    [token, statusFilter, followFilter, sourceFilter, priorityFilter, mine, searchTerm, pageSize],
  );

  useEffect(() => {
    if (token) fetchInquiries(tablePage);
  }, [token, fetchInquiries, tablePage]);

  useEffect(() => {
    if (!token) return;
    if (isAdmin) {
      getLeadAssignableMembers(token)
        .then((r) => setAssignableMembers(r.members || []))
        .catch(() => setAssignableMembers([]));
    }
    fetchSettings(token)
      .then((s) => setAgencyName(s?.agencyName || s?.agency_name || ""))
      .catch(() => {});
  }, [token, isAdmin]);

  // Keep the open lead in the URL so a refresh / shared link reopens it.
  const openLead = (id, wa = false) => {
    setDrawer({ id, wa });
    const next = new URLSearchParams(params);
    next.set("lead", String(id));
    setParams(next, { replace: true });
  };
  const closeLead = () => {
    setDrawer(null);
    const next = new URLSearchParams(params);
    next.delete("lead");
    setParams(next, { replace: true });
  };

  // A change in the drawer updates its row at once, then the counts quietly.
  const onLeadChanged = (lead) => {
    setInquiries((rows) => rows.map((r) => (r.id === lead.id ? { ...r, ...lead, assignee: lead.assignee ?? r.assignee } : r)));
    fetchInquiries(tablePage, { quiet: true });
  };

  const handleDelete = async (inquiry) => {
    if (!window.confirm(`Delete the lead for ${inquiry.client_name}? Its timeline goes with it.`)) return;
    try {
      await deleteLeadInquiry(token, inquiry.id);
      toast.success("Lead deleted");
      if (drawer?.id === inquiry.id) closeLead();
      fetchInquiries(tablePage, { quiet: true });
    } catch (error) {
      console.error("Error deleting inquiry:", error);
      toast.error("Failed to delete lead");
    }
  };

  const handleBulkImportLeads = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      await importLeadInquiries(token, file);
      toast.success("Leads imported successfully");
      fetchInquiries(tablePage, { quiet: true });
    } catch (error) {
      console.error("Error importing leads:", error);
      toast.error(error.message || "Failed to import leads");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const handleDownloadLeadTemplate = async () => {
    try {
      setDownloadingTemplate(true);

      const wb = XLSX.utils.book_new();
      const leadRows = [
        [
          "client_name",
          "client_email",
          "client_phone",
          "destination",
          "adults",
          "kids_cnb",
          "kids_5_to_12",
          "start_date",
          "duration",
          "approximate_budget",
          "currency",
          "special_requests",
          "status",
          "notes",
        ],
        [
          "Ayaan Khan",
          "ayaan@example.com",
          "+919876543210",
          "Paris",
          2,
          0,
          1,
          "2026-06-15",
          5,
          45000,
          "INR (₹)",
          "Need airport pickup",
          "new",
          "VIP lead",
        ],
        [
          "Sara Ali",
          "sara@example.com",
          "+919876543211",
          "Leh",
          4,
          1,
          0,
          "2026-07-02",
          6,
          78000,
          "INR (₹)",
          "Prefers 4-star hotels",
          "contacted",
          "Follow up after 2 days",
        ],
      ];

      const ws = XLSX.utils.aoa_to_sheet(leadRows);
      XLSX.utils.book_append_sheet(wb, ws, "Leads");
      XLSX.writeFile(wb, "lead_import_template.xlsx");

      toast.success("Sample template downloaded");
    } catch (error) {
      console.error("Error downloading template:", error);
      toast.error("Failed to download template");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handlePageSizeChange = (value) => {
    setPageSize(value);
    setPagination((prev) => ({ ...prev, perPage: value }));
  };

  const pickTab = (key) => {
    setStatusFilter(key);
    setFollowFilter("");
  };
  const pickFollow = (key) => {
    setFollowFilter((f) => (f === key ? "" : key));
    setStatusFilter("open");
  };

  const primaryHeaderButtonClass =
    "flex items-center gap-1.5 bg-[#e7f63c] text-[#181c22] px-4 py-2 rounded-lg font-bold shadow-sm hover:bg-[#d4e42e] transition-all text-xs w-fit";
  const secondaryHeaderButtonClass =
    "flex items-center gap-1.5 bg-slate-100 text-slate-700 border border-slate-200 px-4 py-2 rounded-lg font-bold hover:bg-slate-200 transition-all text-xs w-fit";
  const selectClass =
    "px-3 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-[#e7f63c]/40";

  const tableHeaders = [
    { label: "Lead" },
    { label: "Contact" },
    { label: "Trip" },
    { label: "Stage" },
    { label: "Next follow-up" },
    ...(isAdmin ? [{ label: "Owner" }] : []),
    { label: "Last touch" },
    { label: "", className: "text-right" },
  ];

  const due = counts.due || 0;
  const overdue = counts.overdue || 0;

  return (
    <DashboardLayout>
      <PageHeader title="Leads" description="Every enquiry, its next step and its whole history — in one place">
        <button onClick={() => navigate("/lead-inquiries/create")} className={primaryHeaderButtonClass}>
          <Plus className="w-3.5 h-3.5" />
          Add Lead
        </button>
        {isAdmin && (
          <>
            <input
              id="leadBulkImportInput"
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleBulkImportLeads}
              disabled={importing}
            />
            <button
              onClick={() => document.getElementById("leadBulkImportInput")?.click()}
              disabled={importing}
              className={`${secondaryHeaderButtonClass} disabled:opacity-60`}
            >
              {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Bulk Import
            </button>
            <button
              onClick={handleDownloadLeadTemplate}
              disabled={downloadingTemplate}
              className={`${secondaryHeaderButtonClass} disabled:opacity-60`}
            >
              {downloadingTemplate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Sample Template
            </button>
            <button onClick={() => navigate("/integrations")} className={secondaryHeaderButtonClass}>
              <Share2 className="w-3.5 h-3.5" />
              Integrations
            </button>
            <button onClick={() => navigate("/embed-settings")} className={secondaryHeaderButtonClass}>
              <Code className="w-3.5 h-3.5" />
              Embed Form
            </button>
          </>
        )}
      </PageHeader>

      {/* Today's work */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <button
          onClick={() => pickFollow("due")}
          className={`text-left rounded-xl border p-4 transition-all ${followFilter === "due" ? "border-red-300 bg-red-50" : "border-slate-100 bg-white hover:border-red-200"}`}
        >
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Follow-ups due</div>
          <div className={`text-2xl font-black mt-1 ${due ? "text-red-600" : "text-slate-900"}`}>{due}</div>
          <div className="text-[11px] text-slate-500">{overdue ? `${overdue} overdue` : "today"}</div>
        </button>
        <button
          onClick={() => pickTab("new")}
          className={`text-left rounded-xl border p-4 transition-all ${statusFilter === "new" && !followFilter ? "border-emerald-300 bg-emerald-50" : "border-slate-100 bg-white hover:border-emerald-200"}`}
        >
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">New — reply first</div>
          <div className="text-2xl font-black mt-1 text-slate-900">{counts.new || 0}</div>
          <div className="text-[11px] text-slate-500">not contacted yet</div>
        </button>
        <button
          onClick={() => pickFollow("none")}
          className={`text-left rounded-xl border p-4 transition-all ${followFilter === "none" ? "border-amber-300 bg-amber-50" : "border-slate-100 bg-white hover:border-amber-200"}`}
        >
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Open pipeline</div>
          <div className="text-2xl font-black mt-1 text-slate-900">{counts.open || 0}</div>
          <div className="text-[11px] text-slate-500">{followFilter === "none" ? "showing: no follow-up set" : "tap: ones with no follow-up"}</div>
        </button>
        <button
          onClick={() => pickTab("converted")}
          className={`text-left rounded-xl border p-4 transition-all ${statusFilter === "converted" ? "border-purple-300 bg-purple-50" : "border-slate-100 bg-white hover:border-purple-200"}`}
        >
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Won</div>
          <div className="text-2xl font-black mt-1 text-slate-900">{counts.converted || 0}</div>
          <div className="text-[11px] text-slate-500">
            {counts.all ? `${Math.round(((counts.converted || 0) / counts.all) * 100)}% conversion` : "—"}
          </div>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Stage tabs */}
        <div className="flex gap-1 px-4 pt-4 overflow-x-auto">
          {TABS.map((t) => {
            const active = statusFilter === t.key && !followFilter;
            const n = counts[t.key] ?? 0;
            return (
              <button
                key={t.key}
                onClick={() => pickTab(t.key)}
                className={`whitespace-nowrap px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 ${active ? "bg-[#181c22] text-white" : "text-slate-500 hover:bg-slate-50"}`}
              >
                {t.label}
                <span className={`px-1.5 rounded-md text-[10px] ${active ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>{n}</span>
              </button>
            );
          })}
        </div>

        <div className="p-4 border-b border-slate-50 flex flex-col md:flex-row items-stretch md:items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search name, phone, email, destination or ID…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-[#e7f63c]/40 placeholder:text-slate-400 placeholder:font-medium"
            />
          </div>
          <select value={followFilter} onChange={(e) => setFollowFilter(e.target.value)} className={selectClass} aria-label="Follow-up">
            <option value="">Any follow-up</option>
            <option value="due">Due today + overdue</option>
            <option value="overdue">Overdue</option>
            <option value="today">Today</option>
            <option value="upcoming">Upcoming</option>
            <option value="none">Not scheduled</option>
          </select>
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className={selectClass} aria-label="Source">
            <option value="">All sources</option>
            {SOURCES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className={selectClass} aria-label="Priority">
            <option value="">Any priority</option>
            {PRIORITIES.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setMine((m) => !m)}
            className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap ${mine ? "bg-[#181c22] text-white" : "bg-slate-50 text-slate-600"}`}
          >
            <UserCheck className="w-3.5 h-3.5" /> My leads
          </button>
        </div>

        <CompactDataTable
          headers={tableHeaders}
          tbodyClassName="divide-y divide-slate-100 text-xs [&_td]:!px-4 [&_td]:!py-2.5"
          loading={loading}
          loadingText="Loading leads..."
          hasRows={inquiries.length > 0}
          emptyIcon={<Inbox className="w-8 h-8" />}
          emptyTitle={followFilter === "due" ? "No follow-ups due" : "No leads here"}
          emptyDescription={
            followFilter === "due"
              ? "You're all caught up."
              : searchTerm
                ? `Nothing matches "${searchTerm}".`
                : "Add a lead from a call or WhatsApp, or embed the enquiry form on your website."
          }
          pagination={pagination}
          onPageChange={setTablePage}
          onPageSizeChange={handlePageSizeChange}
        >
          {inquiries.map((inquiry) => {
            const stage = stageOf(inquiry.status);
            const prio = priorityOf(inquiry.priority);
            const fu = isOpenStage(inquiry.status) ? followUpBadge(inquiry.next_follow_up_at) : null;
            const pax = (inquiry.adults || 0) + (inquiry.kids_cnb || 0) + (inquiry.kids_5_to_12 || 0);
            const canWa = !!waNumber(inquiry.client_phone);
            return (
              <tr
                key={inquiry.id}
                onClick={() => openLead(inquiry.id)}
                className={`cursor-pointer hover:bg-slate-50/70 transition-colors ${drawer?.id === inquiry.id ? "bg-[#e7f63c]/10" : ""}`}
              >
                <td>
                  <div className="min-w-40">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${prio.dot}`} title={`${prio.label} lead`} />
                      <span className="font-bold text-slate-900 line-clamp-1">{inquiry.client_name}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      <span className="font-mono">{inquiry.inquiry_id}</span> · {sourceLabel(inquiry.source)}
                    </div>
                  </div>
                </td>
                <td>
                  <div className="space-y-1 min-w-44">
                    {inquiry.client_phone ? (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <a href={`tel:${inquiry.client_phone}`} onClick={(e) => e.stopPropagation()} className="hover:text-blue-600">
                          {inquiry.client_phone}
                        </a>
                      </div>
                    ) : null}
                    {inquiry.client_email ? (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-600 truncate max-w-52">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate" title={inquiry.client_email}>{inquiry.client_email}</span>
                      </div>
                    ) : null}
                    {!inquiry.client_phone && !inquiry.client_email && <span className="text-[11px] text-slate-300">No contact</span>}
                  </div>
                </td>
                <td>
                  <div className="space-y-0.5 min-w-44">
                    <div className="font-semibold text-slate-800 truncate max-w-52" title={inquiry.destination || ""}>
                      {inquiry.destination || <span className="text-slate-300">—</span>}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      {inquiry.start_date ? (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(inquiry.start_date)}
                          {inquiry.duration ? ` · ${inquiry.duration}N` : ""}
                        </span>
                      ) : (
                        <span className="text-slate-400">Dates TBD</span>
                      )}
                      {pax ? (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {pax}
                        </span>
                      ) : null}
                      {inquiry.approximate_budget ? <span>₹{Number(inquiry.approximate_budget).toLocaleString("en-IN")}</span> : null}
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase border ${stage.tone}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${stage.dot}`} />
                    {stage.label}
                  </span>
                </td>
                <td>
                  {fu ? (
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border whitespace-nowrap ${fu.tone}`}>
                      {fu.state === "overdue" || fu.state === "due" ? <AlertCircle className="w-3 h-3" /> : null}
                      {fu.label}
                    </span>
                  ) : isOpenStage(inquiry.status) ? (
                    <span className="text-[11px] font-semibold text-slate-400">Not set</span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                {isAdmin && (
                  <td>
                    <span className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">{inquiry.assignee?.name || "Unassigned"}</span>
                  </td>
                )}
                <td>
                  <div className="text-[11px] text-slate-500 whitespace-nowrap">
                    {inquiry.last_contacted_at ? `Contacted ${timeAgo(inquiry.last_contacted_at)}` : `Received ${timeAgo(inquiry.created_at)}`}
                  </div>
                </td>
                <td>
                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => openLead(inquiry.id, true)}
                      disabled={!canWa}
                      className="p-2 rounded-xl text-green-600 hover:bg-green-50 disabled:opacity-30 disabled:hover:bg-transparent"
                      title={canWa ? "Message on WhatsApp" : "No valid phone number"}
                    >
                      <WhatsAppGlyph className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(inquiry)} className="p-2 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </div>
                </td>
              </tr>
            );
          })}
        </CompactDataTable>
      </div>

      {drawer && (
        <LeadDrawer
          key={drawer.id}
          leadId={drawer.id}
          startWithWhatsApp={drawer.wa}
          token={token}
          user={user}
          isAdmin={isAdmin}
          members={assignableMembers.filter((m) => m.role === "team")}
          agencyName={agencyName}
          onClose={closeLead}
          onChanged={onLeadChanged}
        />
      )}
    </DashboardLayout>
  );
};

export default LeadInquiries;
