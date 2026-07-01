import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "./DashboardLayout";
import { formatDate } from "../../utils/dateUtils";
import {
  Mail,
  Phone,
  MapPin,
  Calendar,
  Users,
  IndianRupee,
  MessageSquare,
  Trash2,
  ArrowRight,
  Search,
  Loader2,
  Inbox,
  Code,
  ExternalLink,
  Globe,
  Plus,
  X,
  Facebook,
  Chrome,
  Share2,
  Upload,
  Download,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  getLeadInquiries,
  getLeadAssignableMembers,
  updateLeadInquiry,
  deleteLeadInquiry,
  convertInquiryToTrip,
  createManualLeadInquiry,
  importLeadInquiries,
} from "../../api/leadInquiries";
import { toast } from "react-toastify";
import PageHeader from "../common/PageHeader";
import CompactDataTable from "../common/CompactDataTable";
import * as XLSX from "xlsx";

const LeadInquiries = () => {
  const { token, user } = useAuth();
  const isAdmin = user?.role === "admin";
  const navigate = useNavigate();
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [notes, setNotes] = useState("");
  const [convertingId, setConvertingId] = useState(null);
  const [assigningId, setAssigningId] = useState(null);
  const [assignableMembers, setAssignableMembers] = useState([]);
  const [importing, setImporting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [tablePage, setTablePage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    lastPage: 1,
    total: 0,
    from: 0,
    to: 0,
    perPage: 25,
  });

  useEffect(() => {
    setTablePage(1);
  }, [statusFilter, searchTerm, pageSize]);

  useEffect(() => {
    if (token) fetchInquiries(tablePage);
  }, [token, statusFilter, searchTerm, pageSize, tablePage]);

  useEffect(() => {
    if (isAdmin) {
      fetchAssignableMembers();
    } else {
      setAssignableMembers([]);
    }
  }, [isAdmin]);

  const fetchInquiries = async (page = 1) => {
    setLoading(true);
    try {
      const response = await getLeadInquiries(token, {
        status: statusFilter,
        search: searchTerm.trim() || undefined,
        page,
        per_page: pageSize,
      });
      setInquiries(response.data || []);
      setPagination({
        currentPage: response.current_page ?? page,
        lastPage: response.last_page ?? 1,
        total: response.total ?? 0,
        from: response.from ?? 0,
        to: response.to ?? 0,
        perPage: response.per_page ?? pageSize,
      });
    } catch (error) {
      console.error("Error fetching inquiries:", error);
      toast.error("Failed to load inquiries");
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignableMembers = async () => {
    try {
      const response = await getLeadAssignableMembers(token);
      setAssignableMembers(response.members || []);
    } catch (error) {
      console.error("Error fetching assignable members:", error);
      setAssignableMembers([]);
    }
  };

  const handleStatusChange = async (inquiryId, newStatus) => {
    try {
      await updateLeadInquiry(token, inquiryId, { status: newStatus });
      toast.success("Status updated successfully");
      fetchInquiries(tablePage);
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const handleAssignmentChange = async (inquiryId, assignedTo) => {
    setAssigningId(inquiryId);
    try {
      const payload = {
        assigned_to: assignedTo === "" ? null : Number(assignedTo),
      };

      await updateLeadInquiry(token, inquiryId, payload);
      toast.success("Lead assignment updated");
      fetchInquiries(tablePage);
    } catch (error) {
      console.error("Error updating assignee:", error);
      toast.error("Failed to update assignee");
    } finally {
      setAssigningId(null);
    }
  };

  const handleNotesSave = async () => {
    try {
      await updateLeadInquiry(token, selectedInquiry.id, { notes });
      toast.success("Notes saved successfully");
      setSelectedInquiry(null);
      fetchInquiries(tablePage);
    } catch (error) {
      console.error("Error saving notes:", error);
      toast.error("Failed to save notes");
    }
  };

  const handleDelete = async (inquiryId) => {
    if (!window.confirm("Are you sure you want to delete this inquiry?")) {
      return;
    }

    try {
      await deleteLeadInquiry(token, inquiryId);
      toast.success("Inquiry deleted successfully");
      fetchInquiries(tablePage);
      if (selectedInquiry?.id === inquiryId) {
        setSelectedInquiry(null);
      }
    } catch (error) {
      console.error("Error deleting inquiry:", error);
      toast.error("Failed to delete inquiry");
    }
  };

  const handleConvertToTrip = async (inquiryId) => {
    if (
      !window.confirm(
        "Convert this inquiry to a trip? This will create a new trip with the inquiry details.",
      )
    )
      return;

    setConvertingId(inquiryId);
    try {
      const response = await convertInquiryToTrip(token, inquiryId);
      toast.success("Successfully converted to trip!");
      if (window.confirm("Would you like to open the trip builder now?")) {
        navigate(`/trip-builder/${response.trip_id || response.data?.trip_id}`);
      } else {
        fetchInquiries(tablePage);
      }
    } catch (error) {
      console.error("Error converting to trip:", error);
      toast.error("Failed to convert to trip");
    } finally {
      setConvertingId(null);
    }
  };

  const handleBulkImportLeads = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      await importLeadInquiries(token, file);
      toast.success("Leads imported successfully");
      fetchInquiries(tablePage);
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

  const getStatusBadgeClass = (status) => {
    const styles = {
      new: "bg-emerald-50 text-emerald-700 border-emerald-200",
      contacted: "bg-blue-50 text-blue-700 border-blue-200",
      quoted: "bg-amber-50 text-amber-700 border-amber-200",
      converted: "bg-purple-50 text-purple-700 border-purple-200",
      closed: "bg-slate-50 text-slate-700 border-slate-200",
    };
    return styles[status] || styles.new;
  };

  const filteredInquiries = inquiries;

  const handlePageSizeChange = (value) => {
    setPageSize(value);
    setPagination((prev) => ({ ...prev, perPage: value }));
  };

  const primaryHeaderButtonClass =
    "flex items-center gap-1.5 bg-[#0a0a0a] text-white px-4 py-2 rounded-lg font-bold shadow-lg shadow-blue-600/20 hover:bg-[#0a0a0a] transition-all text-xs w-fit";
  const secondaryHeaderButtonClass =
    "flex items-center gap-1.5 bg-slate-100 text-slate-700 border border-slate-200 px-4 py-2 rounded-lg font-bold hover:bg-slate-200 transition-all text-xs w-fit";

  const tableHeaders = [
    { label: "ID" },
    { label: "Client" },
    { label: "Contact" },
    { label: "Trip Details" },
    ...(isAdmin ? [{ label: "Assigned To" }] : []),
    { label: "Status" },
    { label: "Received" },
    { label: "Actions", className: "text-right" },
  ];

  return (
    <DashboardLayout>
      <PageHeader
        title="Lead Inquiries"
        description="Manage leads from your embeddable inquiry form"
      >
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
              onClick={() =>
                document.getElementById("leadBulkImportInput")?.click()
              }
              disabled={importing}
              className="flex items-center gap-1.5 bg-teal-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg shadow-teal-500/20 hover:bg-teal-700 transition-all text-xs w-fit disabled:opacity-60"
            >
              {importing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              Bulk Import
            </button>

            <button
              onClick={handleDownloadLeadTemplate}
              disabled={downloadingTemplate}
              className="flex items-center gap-1.5 bg-amber-100 text-amber-800 border border-amber-200 px-4 py-2 rounded-lg font-bold hover:bg-amber-200 transition-all text-xs w-fit disabled:opacity-60"
            >
              {downloadingTemplate ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              Sample Template
            </button>

            <button
              onClick={() => navigate("/lead-inquiries/create")}
              className={primaryHeaderButtonClass}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Lead
            </button>

            <button
              onClick={() => navigate("/integrations")}
              className={secondaryHeaderButtonClass}
            >
              <Share2 className="w-3.5 h-3.5" />
              Integrations
            </button>

            <button
              onClick={() => navigate("/embed-settings")}
              className={secondaryHeaderButtonClass}
            >
              <Code className="w-3.5 h-3.5" />
              Get Embed Code
            </button>
          </>
        )}
      </PageHeader>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email, destination, or inquiry ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#c7f135]/20 transition-all placeholder:text-slate-300 placeholder:font-medium"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full md:w-44 px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#c7f135]/20 transition-all"
          >
            <option value="all">All Status</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="quoted">Quoted</option>
            <option value="converted">Converted</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <CompactDataTable
          headers={tableHeaders}
          tbodyClassName="divide-y divide-slate-100 text-xs [&_td]:!px-4 [&_td]:!py-2.5"
          loading={loading}
          loadingText="Loading inquiries..."
          hasRows={filteredInquiries.length > 0}
          emptyIcon={<Inbox className="w-8 h-8" />}
          emptyTitle="No Inquiries Yet"
          emptyDescription={
            statusFilter !== "all"
              ? `No inquiries with status "${statusFilter}"`
              : "Embed your inquiry form on your website to start receiving leads"
          }
          pagination={pagination}
          onPageChange={setTablePage}
          onPageSizeChange={handlePageSizeChange}
        >
          {filteredInquiries.map((inquiry) => (
            <tr
              key={inquiry.id}
              className="hover:bg-slate-50/50 transition-colors group"
            >
              <td>
                <div className="font-mono text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                  {inquiry.inquiry_id}
                </div>
              </td>

              <td>
                <div className="space-y-0.5 min-w-40">
                  <div className="font-semibold text-slate-900 line-clamp-1">
                    {inquiry.client_name}
                  </div>
                  <div
                    className="text-[11px] text-slate-500 truncate max-w-50"
                    title={inquiry.destination || "-"}
                  >
                    {inquiry.destination || "-"}
                  </div>
                </div>
              </td>

              <td>
                <div className="space-y-1 min-w-50">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-600 truncate">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <a
                      href={`mailto:${inquiry.client_email}`}
                      className="hover:text-blue-500 transition-colors truncate"
                      title={inquiry.client_email}
                    >
                      {inquiry.client_email}
                    </a>
                  </div>
                  {inquiry.client_phone ? (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <a
                        href={`tel:${inquiry.client_phone}`}
                        className="hover:text-blue-500 transition-colors"
                      >
                        {inquiry.client_phone}
                      </a>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400">No phone</div>
                  )}
                </div>
              </td>

              <td>
                <div className="space-y-1 min-w-55">
                  <div className="flex items-center gap-1.5 font-medium text-slate-800 line-clamp-1">
                    <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span
                      className="truncate"
                      title={inquiry.destination || "-"}
                    >
                      {inquiry.destination || "-"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500">
                    {inquiry.start_date ? (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>
                          {formatDate(inquiry.start_date)}
                          {inquiry.duration ? ` • ${inquiry.duration}N` : ""}
                        </span>
                      </div>
                    ) : (
                      <div className="text-slate-400">Date TBD</div>
                    )}
                    {inquiry.pax ? (
                      <div className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {inquiry.pax}
                      </div>
                    ) : null}
                  </div>
                  {inquiry.approximate_budget ? (
                    <div className="flex items-center gap-1 text-[11px] text-slate-500">
                      <IndianRupee className="w-3.5 h-3.5" />
                      {inquiry.currency} {inquiry.approximate_budget}
                    </div>
                  ) : null}
                  {inquiry.special_requests ? (
                    <p
                      className="text-[11px] text-slate-400 line-clamp-1"
                      title={inquiry.special_requests}
                    >
                      {inquiry.special_requests}
                    </p>
                  ) : null}
                </div>
              </td>

              {isAdmin && (
                <td>
                  {inquiry.status === "converted" ? (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-semibold border border-slate-200 bg-slate-50 text-slate-700">
                      {inquiry.assignee?.name || "Unassigned"}
                    </span>
                  ) : (
                    <select
                      value={
                        assignableMembers.some(
                          (member) => member.id === inquiry.assigned_to,
                        )
                          ? inquiry.assigned_to
                          : ""
                      }
                      onChange={(e) =>
                        handleAssignmentChange(inquiry.id, e.target.value)
                      }
                      disabled={assigningId === inquiry.id}
                      className="min-w-36 px-2.5 py-1 rounded-lg text-[10px] font-semibold border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#c7f135] disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <option value="">Unassigned</option>
                      {assignableMembers
                        .filter((member) => member.role === "team")
                        .map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                    </select>
                  )}
                </td>
              )}

              <td>
                <select
                  value={inquiry.status}
                  onChange={(e) =>
                    handleStatusChange(inquiry.id, e.target.value)
                  }
                  disabled={inquiry.status === "converted"}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase border ${getStatusBadgeClass(
                    inquiry.status,
                  )} focus:outline-none focus:ring-2 focus:ring-[#c7f135] disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="quoted">Quoted</option>
                  <option value="converted">Converted</option>
                  <option value="closed">Closed</option>
                </select>
              </td>

              <td>
                <div className="text-xs text-slate-600">
                  {formatDate(inquiry.created_at)}
                </div>
                <div className="text-xs text-slate-400">
                  {new Date(inquiry.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </td>

              <td>
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => {
                      setSelectedInquiry(inquiry);
                      setNotes(inquiry.notes || "");
                    }}
                    className="p-2 hover:bg-blue-50 rounded-xl transition-colors group/btn"
                    title="Notes"
                  >
                    <MessageSquare className="w-4 h-4 text-slate-400 group-hover/btn:text-blue-500" />
                  </button>
                  {inquiry.status !== "converted" && (
                    <button
                      onClick={() => handleConvertToTrip(inquiry.id)}
                      disabled={convertingId === inquiry.id}
                      className="p-2 hover:bg-green-50 rounded-xl transition-colors group/btn disabled:opacity-50"
                      title="Convert to Trip"
                    >
                      {convertingId === inquiry.id ? (
                        <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                      ) : (
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover/btn:text-green-500" />
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(inquiry.id)}
                    className="p-2 hover:bg-red-50 rounded-xl transition-colors group/btn"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-slate-400 group-hover/btn:text-red-500" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </CompactDataTable>
      </div>

      {/* Notes Modal */}
      {selectedInquiry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-4xl max-w-2xl w-full p-8 shadow-2xl">
            <h3 className="text-2xl font-black text-slate-900 mb-2">
              Notes for {selectedInquiry.client_name}
            </h3>
            <p className="text-sm text-slate-400 mb-6">
              {selectedInquiry.inquiry_id}
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add internal notes about this inquiry..."
              rows={6}
              className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#c7f135] text-slate-700 resize-none"
            />
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setSelectedInquiry(null)}
                className="px-6 py-3 rounded-2xl font-semibold text-slate-600 hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleNotesSave}
                className="px-6 py-3 rounded-2xl font-semibold bg-linear-to-r from-[#c7f135] to-[#b0dc00] text-[#10182a] hover:shadow-lg hover:shadow-[#c7f135]/40 transition-all"
              >
                Save Notes
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default LeadInquiries;
