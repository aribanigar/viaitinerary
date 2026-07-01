import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "./DashboardLayout";
import {
  FileText,
  Calendar,
  Edit3,
  MapPin,
  Plus,
  Clock,
  CheckCircle2,
  Trash2,
  Search,
  Loader2,
  Filter,
  Copy,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  fetchTrips,
  deleteTrip,
  fetchSubscriptionStatus,
  updateTrip,
  duplicateTrip,
  fetchTrip,
  downloadConfirmationPdf,
  downloadPaymentVoucherPdf,
  sendConfirmationEmail,
} from "../../api/trips";
import Loader from "../common/Loader";
import { toast } from "react-toastify";
import Pagination from "../common/Pagination";
import SubscriptionBanner from "../common/SubscriptionBanner";
import Modal from "../common/Modal";
import PageHeader from "../common/PageHeader";

const parseTripStartDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value !== "string") return null;

  const s = value.trim();
  if (!s) return null;

  // API commonly returns DD-MM-YYYY (e.g., 25-03-2026)
  const dmy = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    const dt = new Date(year, month - 1, day);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  // Also support YYYY-MM-DD or ISO strings
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);
    const dt = new Date(year, month - 1, day);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const MyTrips = () => {
  const { token, user } = useAuth();
  const [trips, setTrips] = useState([]);

  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [createdByFilter, setCreatedByFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState(null);
  const [pageSize, setPageSize] = useState(25);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    lastPage: 1,
    total: 0,
    from: 0,
    to: 0,
    perPage: 25,
  });
  const [sendingEmailId, setSendingEmailId] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState(0);
  const [processingPayment, setProcessingPayment] = useState(false);

  const loadTrips = async (page = 1) => {
    try {
      setLoading(true);
      const resp = await fetchTrips(token, {
        page,
        per_page: pageSize,
        search: searchQuery,
      });
      setTrips(resp.data);
      setPagination({
        currentPage: resp.current_page,
        lastPage: resp.last_page,
        total: resp.total,
        from: resp.from,
        to: resp.to,
        perPage: resp.per_page ?? pageSize,
      });
    } catch (err) {
      console.error("Failed to load trips:", err);
      toast.error(err.message || "Failed to load trips");
    } finally {
      setLoading(false);
    }
  };

  const loadSubscription = async () => {
    try {
      const subData = await fetchSubscriptionStatus(token);
      setSubscription(subData);
    } catch (err) {
      console.error("Failed to load subscription:", err);
    }
  };

  useEffect(() => {
    if (token) {
      loadTrips(1);
      loadSubscription();
    }
  }, [token, searchQuery, pageSize]);

  const handlePageSizeChange = (value) => {
    setPageSize(value);
    setPagination((prev) => ({ ...prev, perPage: value }));
  };

  const filteredTrips = trips.filter(
    (t) =>
      (!statusFilter || t.status === statusFilter) &&
      (!createdByFilter || t.created_by === createdByFilter),
  );

  const handleDelete = async (tripId) => {
    if (window.confirm("Are you sure you want to delete this trip?")) {
      try {
        await deleteTrip(token, tripId);
        toast.success("Trip deleted successfully!");
        loadTrips(pagination.currentPage);
        loadSubscription(); // Refresh subscription usage
      } catch (err) {
        toast.error(err.message || "Failed to delete trip");
      }
    }
  };

  const handleStatusChange = async (tripId, newStatus) => {
    if (newStatus === "rejected") {
      const trip = trips.find((t) => (t.trip_id || t.tripId) === tripId);
      if (trip) {
        setSelectedTrip(trip);
        setRefundAmount(trip.paid_amount || 0);
        setShowRefundModal(true);
        return;
      }
    }

    try {
      await updateTrip(token, tripId, { status: newStatus });
      setTrips(
        trips.map((t) =>
          (t.trip_id || t.tripId) === tripId ? { ...t, status: newStatus } : t,
        ),
      );
      toast.success("Status updated successfully");
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleRefundSubmit = async (e) => {
    try {
      await updateTrip(token, selectedTrip.trip_id || selectedTrip.tripId, {
        status: "rejected",
        refunded_amount: refundAmount,
      });
      toast.success("Trip rejected and refund recorded!");
      setShowRefundModal(false);
      loadTrips(pagination.currentPage);
    } catch (err) {
      toast.error(err.message || "Failed to update refund");
    }
  };

  const handleDuplicate = async (tripId) => {
    try {
      setDuplicatingId(tripId);
      await duplicateTrip(token, tripId);
      toast.success("Trip duplicated successfully!");
      loadTrips(pagination.currentPage);
      loadSubscription(); // Update usage limits
    } catch (err) {
      toast.error(err.message || "Failed to duplicate trip");
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleSendEmail = async (tripId) => {
    try {
      setSendingEmailId(tripId);

      // 1. Generate & Download PDF
      const blob = await downloadConfirmationPdf(token, tripId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Trip_Confirmation_${tripId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // 2. Send Email & Get WhatsApp Link (Backend also updates status if pending)
      const resp = await sendConfirmationEmail(token, tripId);
      toast.success(resp.message || "Confirmation email queued!");

      // 3. Open WhatsApp if available
      if (resp && resp.whatsapp_url) {
        window.open(resp.whatsapp_url, "_blank");
      }

      // Refresh list to show updated status
      loadTrips(pagination.currentPage);
    } catch (err) {
      toast.error(err.message || "Failed to process confirmation");
    } finally {
      setSendingEmailId(null);
    }
  };

  const handlePaymentClick = async (trip) => {
    try {
      const tripDetails = await fetchTrip(token, trip.trip_id || trip.tripId);
      setSelectedTrip(tripDetails);
      setPaidAmount(0); // Reset to 0 so agent enters the NEW payment amount
      setPaymentMethod(tripDetails.payment_method || "cash");
      setShowPaymentModal(true);
    } catch (err) {
      console.error("Failed to load trip details:", err);
      toast.error(err.message || "Failed to load trip details");
    }
  };

  const handlePaymentSubmit = async (e) => {
    try {
      const totalCost = parseFloat(selectedTrip?.cost || 0);
      const alreadyPaid = parseFloat(selectedTrip?.paid_amount || 0);
      const newPayment = parseFloat(paidAmount || 0);

      if (alreadyPaid + newPayment > totalCost) {
        toast.error(
          `Total payment (₹${alreadyPaid + newPayment}) cannot exceed total cost (₹${totalCost})`,
        );
        return;
      }
      setProcessingPayment(true);
      const tripId = selectedTrip.trip_id || selectedTrip.tripId;

      // 1. Update Payment (Backend will add this to existing paid_amount)
      const resp = await updateTrip(token, tripId, {
        new_payment: newPayment,
        payment_method: paymentMethod,
      });

      toast.success("Payment details saved successfully!");

      // 2. Download Voucher PDF
      try {
        const blob = await downloadPaymentVoucherPdf(token, tripId);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Payment_Voucher_${tripId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (pdfErr) {
        console.error("Voucher download failed:", pdfErr);
        toast.error("Voucher PDF generation failed, but payment was saved.");
      }

      // 3. Open WhatsApp if available
      if (resp && resp.whatsapp) {
        const { phone, message } = resp.whatsapp;
        const encodedMsg = encodeURIComponent(message);
        setTimeout(() => {
          window.open(`https://wa.me/${phone}?text=${encodedMsg}`, "_blank");
        }, 100);
      }

      setShowPaymentModal(false);
      loadTrips(pagination.currentPage);
    } catch (err) {
      toast.error(err.message || "Failed to update payment");
    } finally {
      setProcessingPayment(false);
    }
  };

  return (
    <DashboardLayout>
      <SubscriptionBanner subscription={subscription} />

      <PageHeader
        title={
          user?.role === "admin" || user?.role === "super_admin"
            ? "Trips"
            : "My Trips"
        }
        description="Manage your saved itineraries and quotes"
      >
        <Link
          to={subscription?.can_create_trip ? "/trip-builder" : "#"}
          onClick={(e) => {
            if (!subscription?.can_create_trip) {
              e.preventDefault();
              toast.error("Upgrade required to create more trips");
            }
          }}
          className={`${subscription?.can_create_trip ? "bg-[#1b1b1b] hover:bg-blue-700" : "bg-slate-400 cursor-not-allowed"} text-white px-8 py-4 rounded-2xl flex items-center gap-3 font-bold text-[13px] shadow-xl transition-all hover:scale-105 no-underline w-full md:w-auto justify-center md:justify-start`}
        >
          <Plus className="w-5 h-5" />
          CREATE NEW TRIP
        </Link>
      </PageHeader>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
        <div className="p-6 border-b border-slate-50 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by title, client or duration..."
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-300 placeholder:font-medium font-medium"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-3 rounded-2xl transition-all ${
              showFilters
                ? "bg-blue-100 text-blue-600"
                : "bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            }`}
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>
        {showFilters && (
          <div className="px-6 pb-4">
            <div className="flex gap-4 items-center">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Created By
                </label>
                <select
                  value={createdByFilter}
                  onChange={(e) => setCreatedByFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="">All Creators</option>
                  {[
                    ...new Set(trips.map((t) => t.created_by).filter(Boolean)),
                  ].map((creator) => (
                    <option key={creator} value={creator}>
                      {creator}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="overflow-visible">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 text-[9px] font-black uppercase tracking-wider text-slate-400">
                  Trip ID
                </th>
                <th className="px-4 py-3 text-[9px] font-black uppercase tracking-wider text-slate-400">
                  Trip Details
                </th>
                <th className="px-4 py-3 text-[9px] font-black uppercase tracking-wider text-slate-400">
                  Status
                </th>
                <th className="px-4 py-3 text-[9px] font-black uppercase tracking-wider text-slate-400">
                  Duration
                </th>
                <th className="px-4 py-3 text-[9px] font-black uppercase tracking-wider text-slate-400">
                  Start Date
                </th>
                <th className="px-4 py-3 text-[9px] font-black uppercase tracking-wider text-slate-400">
                  Created By
                </th>
                <th className="px-4 py-3 text-[9px] font-black uppercase tracking-wider text-slate-400 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs font-medium">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 rounded-[2rem] bg-slate-50 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                      </div>
                      <div className="font-bold text-slate-900">
                        Loading trips...
                      </div>
                    </div>
                  </td>
                </tr>
              ) : filteredTrips.length > 0 ? (
                filteredTrips.map((trip) => (
                  <tr
                    key={trip.trip_id || trip.tripId}
                    className="hover:bg-slate-50/50 group transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold text-slate-700 font-mono">
                        {trip.trip_id || trip.tripId || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-bold text-slate-900 capitalize">
                          {trip.trip_title || trip.tripTitle || "Untitled Trip"}
                        </div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                          {trip.client_name ||
                            trip.clientName ||
                            "Unknown Client"}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={trip.status}
                        onChange={(e) =>
                          handleStatusChange(
                            trip.trip_id || trip.tripId,
                            e.target.value,
                          )
                        }
                        className="px-2 py-1 bg-slate-100 text-slate-600 text-[9px] font-bold rounded-md uppercase tracking-wider border-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                      >
                        <option value="pending">Pending</option>
                        <option value="rejected">Rejected</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="completed">Completed</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-xs font-bold text-slate-700">
                          {parseInt(trip.duration || 0) + 1}D /{" "}
                          {parseInt(trip.duration || 0)}N
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-xs font-bold text-slate-700">
                          {parseTripStartDate(
                            trip.start_date || trip.startDate,
                          )?.toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                          }) ?? "N/A"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold text-slate-700">
                        {trip.created_by || "Unknown"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          to={`/trip-builder/${trip.trip_id || trip.tripId}`}
                          className="p-1.5 hover:bg-blue-50 text-slate-300 hover:text-blue-600 rounded-lg transition-all"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          onClick={() =>
                            handleDuplicate(trip.trip_id || trip.tripId)
                          }
                          disabled={
                            duplicatingId === (trip.trip_id || trip.tripId)
                          }
                          className="p-1.5 hover:bg-emerald-50 text-slate-300 hover:text-emerald-600 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Duplicate Trip"
                        >
                          {duplicatingId === (trip.trip_id || trip.tripId) ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() =>
                            handleDelete(trip.trip_id || trip.tripId)
                          }
                          className="p-1.5 hover:bg-red-50 text-slate-300 hover:text-red-600 rounded-lg transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-20 h-20 rounded-[2.5rem] bg-slate-50 flex items-center justify-center text-slate-300">
                        <FileText className="w-10 h-10" />
                      </div>
                      <div className="space-y-1">
                        <div className="font-bold text-slate-900">
                          No trips found
                        </div>
                        <p className="text-slate-400 text-xs">
                          {searchQuery
                            ? "Try a different search term or create a new trip."
                            : "You haven't created any trip itineraries yet. Start your first adventure today!"}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={pagination.currentPage}
          lastPage={pagination.lastPage}
          total={pagination.total}
          from={pagination.from}
          to={pagination.to}
          onPageChange={loadTrips}
          pageSize={pageSize}
          onPageSizeChange={handlePageSizeChange}
        />
      </div>
      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Payment Details"
        subtitle={`For ${selectedTrip?.trip_title || selectedTrip?.tripTitle || "Trip"}`}
        submitButtonText={
          processingPayment ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </div>
          ) : (
            "Update Payment"
          )
        }
        onSubmit={handlePaymentSubmit}
        isEditing={!processingPayment}
      >
        <div className="space-y-4">
          {processingPayment && (
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 mb-4 animate-pulse">
              <p className="text-sm text-blue-800 font-medium">
                Saving payment and preparing documents...
              </p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Payment Summary
            </label>
            <div className="flex justify-between items-center text-sm mt-1 mb-4 p-3 bg-slate-50 rounded-xl">
              <div>
                <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                  Cost
                </p>
                <p className="font-bold text-slate-900">
                  ₹{selectedTrip?.cost || 0}
                </p>
              </div>
              <div className="text-right">
                <p className="text-emerald-500 text-[10px] uppercase font-bold tracking-wider">
                  Already Paid
                </p>
                <p className="font-bold text-emerald-600">
                  ₹{selectedTrip?.paid_amount || 0}
                </p>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              New Payment Amount
            </label>
            <input
              type="number"
              className={`w-full p-2 border rounded-xl text-sm font-medium ${
                parseFloat(selectedTrip?.paid_amount || 0) +
                  parseFloat(paidAmount || 0) >
                parseFloat(selectedTrip?.cost || 0)
                  ? "border-rose-500 bg-rose-50 text-rose-900"
                  : "border-slate-200"
              }`}
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              placeholder="Enter amount being paid now"
            />
            {parseFloat(selectedTrip?.paid_amount || 0) +
              parseFloat(paidAmount || 0) >
              parseFloat(selectedTrip?.cost || 0) && (
              <p className="mt-1 text-[10px] text-rose-500 font-bold uppercase tracking-wider">
                Total (₹
                {parseFloat(selectedTrip?.paid_amount || 0) +
                  parseFloat(paidAmount || 0)}
                ) will exceed cost of ₹{selectedTrip?.cost || 0}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Payment Method
            </label>
            <select
              className="w-full p-2 border border-slate-200 rounded-xl text-sm font-medium"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="cash">Cash</option>
              <option value="bank account">Bank Account</option>
              <option value="upi">UPI</option>
              <option value="google pay">Google Pay</option>
            </select>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showRefundModal}
        onClose={() => setShowRefundModal(false)}
        title="Refund Information"
        subtitle={`Trip: ${selectedTrip?.trip_title || selectedTrip?.tripTitle || "Trip"}`}
        submitButtonText="Confirm Rejection & Refund"
        onSubmit={handleRefundSubmit}
        isEditing={true}
      >
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 mb-4">
            <p className="text-sm text-amber-800">
              You are marking this trip as <strong>Rejected</strong>. Please
              specify the amount being refunded to the client.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Total Price
            </label>
            <div className="text-lg font-bold text-slate-900">
              ₹{selectedTrip?.cost || 0}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Paid Amount (to be refunded)
            </label>
            <div className="text-lg font-bold text-emerald-600 font-mono">
              ₹{selectedTrip?.paid_amount || 0}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Actual Refunded Amount
            </label>
            <input
              type="number"
              className="w-full p-3 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-rose-500/20 transition-all font-mono"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              placeholder="Enter refunded amount"
            />
            <p className="mt-1 text-[10px] text-slate-400 font-medium">
              Defaults to current paid amount.
            </p>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
};

export default MyTrips;
