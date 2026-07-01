import React, { useEffect, useMemo, useState } from "react";
import DashboardLayout from "./DashboardLayout";
import PageHeader from "../common/PageHeader";
import Loader from "../common/Loader";
import Modal from "../common/Modal";
import DatePicker from "../common/DatePicker";
import { useAuth } from "../../context/AuthContext";
import {
  fetchAccountingLedger,
  fetchAccountingTripLedger,
  createAccountingSettlement,
  updateAccountingSettlement,
  deleteAccountingSettlement,
} from "../../api/accounting";
import { toast } from "react-toastify";
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
  Search,
} from "lucide-react";
import Pagination from "../common/Pagination";

const STATUS_OPTIONS = ["pending", "partial", "settled"];

const parseCurrencySymbol = (currency) => {
  if (!currency || typeof currency !== "string") return "₹";
  const match = currency.match(/\((.*?)\)/);
  return match?.[1] || "₹";
};

const currencyValue = (symbol, value) => {
  const n = Number(value || 0);
  return `${symbol}${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
};

const formatSettlementDate = (value) => {
  if (!value) return "N/A";
  const datePart = String(value).split("T")[0];
  const [year, month, day] = datePart.split("-");
  if (!year || !month || !day) return datePart;
  return `${day}-${month}-${year}`;
};

const Ledger = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    total: 0,
    per_page: 25,
    from: 0,
    to: 0,
  });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedTripId, setExpandedTripId] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [tripDetail, setTripDetail] = useState(null);
  const [detailError, setDetailError] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [targetObligation, setTargetObligation] = useState(null);
  const [editingSettlement, setEditingSettlement] = useState(null);
  const [settlementForm, setSettlementForm] = useState({
    amount: "",
    settlement_type: "",
    settlement_date: new Date().toISOString().slice(0, 10),
    method: "",
    notes: "",
  });

  const loadLedger = async (page = 1, perPage = pagination.per_page) => {
    if (!token) return;
    try {
      setLoading(true);
      const resp = await fetchAccountingLedger(token, {
        page,
        per_page: perPage,
        query,
        status: statusFilter,
      });
      setRows(resp?.data || []);
      setPagination((prev) => ({
        ...prev,
        current_page: resp?.current_page || 1,
        last_page: resp?.last_page || 1,
        total: resp?.total || 0,
        from: resp?.from ?? 0,
        to: resp?.to ?? 0,
        per_page: resp?.per_page ?? perPage,
      }));
    } catch (err) {
      setRows([]);
      toast.error(err.message || "Failed to load ledger data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLedger(1);
  }, [token]);

  const handleFilterApply = () => {
    loadLedger(1);
  };

  const handlePageSizeChange = (value) => {
    setPagination((prev) => ({ ...prev, per_page: value }));
    loadLedger(1, value);
  };

  const loadTripDetail = async (tripId) => {
    try {
      setDetailLoading(true);
      setDetailError("");
      const resp = await fetchAccountingTripLedger(token, tripId);
      setTripDetail(resp);
    } catch (err) {
      setTripDetail(null);
      setDetailError(err.message || "Failed to load trip accounting details.");
    } finally {
      setDetailLoading(false);
    }
  };

  const toggleExpand = async (tripId) => {
    if (expandedTripId === tripId) {
      setExpandedTripId("");
      setTripDetail(null);
      return;
    }
    setExpandedTripId(tripId);
    await loadTripDetail(tripId);
  };

  const openSettlementModal = (obligation) => {
    const defaultType =
      obligation?.direction === "receivable" ? "receipt" : "payment";
    setTargetObligation(obligation);
    setEditingSettlement(null);
    setSettlementForm({
      amount: "",
      settlement_type: defaultType,
      settlement_date: new Date().toISOString().slice(0, 10),
      method: "cash",
      notes: "",
    });
    setIsModalOpen(true);
  };

  const openEditSettlementModal = (obligation, settlement) => {
    const formattedDate = settlement?.settlement_date
      ? String(settlement.settlement_date).split("T")[0]
      : new Date().toISOString().slice(0, 10);

    setTargetObligation(obligation);
    setEditingSettlement(settlement);
    setSettlementForm({
      amount: String(settlement?.amount ?? ""),
      settlement_type: settlement?.settlement_type || "",
      settlement_date: formattedDate,
      method: settlement?.method || "cash",
      notes: settlement?.notes || "",
    });
    setIsModalOpen(true);
  };

  const closeSettlementModal = () => {
    setIsModalOpen(false);
    setEditingSettlement(null);
  };

  const handleSaveSettlement = async () => {
    if (!targetObligation) return;

    const remaining =
      Number(targetObligation.expected_amount || 0) -
      Number(targetObligation.settled_amount || 0);
    const currentlySettledAmount = Number(editingSettlement?.amount || 0);
    const allowedAmount = remaining + currentlySettledAmount;
    const amount = Number(settlementForm.amount || 0);

    if (!amount || amount <= 0) {
      toast.error("Amount must be greater than 0.");
      return;
    }

    if (amount > allowedAmount + 0.01) {
      toast.error(
        `Amount cannot exceed the due amount of ${allowedAmount.toLocaleString()}.`,
      );
      return;
    }

    try {
      setSaving(true);
      const payload = {
        obligation_id: targetObligation.id,
        amount,
        settlement_type: settlementForm.settlement_type,
        settlement_date: settlementForm.settlement_date,
        method: settlementForm.method || null,
        notes: settlementForm.notes || null,
      };

      if (editingSettlement?.id) {
        await updateAccountingSettlement(token, editingSettlement.id, payload);
        toast.success("Settlement updated.");
      } else {
        await createAccountingSettlement(token, payload);
        toast.success("Settlement added.");
      }

      closeSettlementModal();
      if (expandedTripId) {
        await loadTripDetail(expandedTripId);
      }
      await loadLedger(pagination.current_page);
    } catch (err) {
      toast.error(err.message || "Failed to save settlement.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSettlement = async (settlementId) => {
    if (!window.confirm("Delete this settlement entry?")) return;
    try {
      await deleteAccountingSettlement(token, settlementId);
      toast.success("Settlement deleted.");
      if (expandedTripId) {
        await loadTripDetail(expandedTripId);
      }
      await loadLedger(pagination.current_page);
    } catch (err) {
      toast.error(err.message || "Failed to delete settlement.");
    }
  };

  const obligationsByGroup = useMemo(() => {
    const items = tripDetail?.obligations || [];
    return {
      receivable: items.filter((x) => x.direction === "receivable"),
      hotel: items.filter(
        (x) => x.direction === "payable" && x.party_type === "hotel",
      ),
      cab: items.filter(
        (x) => x.direction === "payable" && x.party_type === "cab",
      ),
      otherPayables: items.filter(
        (x) =>
          x.direction === "payable" && !["hotel", "cab"].includes(x.party_type),
      ),
    };
  }, [tripDetail]);

  const submitButtonLabel = useMemo(() => {
    const verb = editingSettlement ? "Update" : "Make";
    if (settlementForm.settlement_type === "receipt") return `${verb} Receipt`;
    if (settlementForm.settlement_type === "payment") return `${verb} Payment`;
    if (settlementForm.settlement_type === "refund") return `${verb} Refund`;
    return `${verb} Settlement`;
  }, [editingSettlement, settlementForm.settlement_type]);

  return (
    <DashboardLayout>
      <PageHeader
        title="Ledger"
        description="Track what you should receive from clients and what you should pay to hotels and cabs."
      />

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden mb-5">
        <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row items-start md:items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleFilterApply()}
              placeholder="Search by Trip ID, title, or client..."
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-[#c7f135]/20 transition-all placeholder:text-slate-300 placeholder:font-medium font-medium"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full md:w-auto px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#c7f135]/20"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <button
            onClick={handleFilterApply}
            className="w-full md:w-auto px-6 py-3 rounded-xl bg-[#c7f135] text-[#10182a] text-sm font-bold shadow-lg shadow-[#c7f135]/40 hover:bg-[#b0dc00] transition-all"
          >
            Apply Filters
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader text="Loading accounting ledger..." />
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-slate-500 uppercase text-[11px] tracking-wider">
                <th className="px-4 py-3">Trip</th>
                <th className="px-4 py-3">Receivable</th>
                <th className="px-4 py-3">Hotel Payable</th>
                <th className="px-4 py-3">Cab Payable</th>
                <th className="px-4 py-3">Net Position</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const symbol = parseCurrencySymbol(row.currency);
                const isOpen = expandedTripId === row.trip_id;
                return (
                  <React.Fragment key={row.trip_id}>
                    <tr
                      className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                      onClick={() => toggleExpand(row.trip_id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isOpen ? (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          )}
                          <div>
                            <div className="font-bold text-slate-900">
                              {row.trip_id}
                            </div>
                            <div className="text-xs text-slate-500">
                              {row.trip_title} - {row.client_name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-900 font-semibold">
                          {currencyValue(symbol, row.receivable_expected)}
                        </div>
                        <div className="text-xs text-slate-500">
                          Got: {currencyValue(symbol, row.receivable_settled)} |
                          Due: {currencyValue(symbol, row.receivable_remaining)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-900 font-semibold">
                          {currencyValue(symbol, row.hotel_expected)}
                        </div>
                        <div className="text-xs text-slate-500">
                          Paid: {currencyValue(symbol, row.hotel_settled)} |
                          Due: {currencyValue(symbol, row.hotel_remaining)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-900 font-semibold">
                          {currencyValue(symbol, row.cab_expected)}
                        </div>
                        <div className="text-xs text-slate-500">
                          Paid: {currencyValue(symbol, row.cab_settled)} | Due:{" "}
                          {currencyValue(symbol, row.cab_remaining)}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {currencyValue(symbol, row.net_position)}
                      </td>
                    </tr>

                    {isOpen && (
                      <tr className="border-t border-slate-100 bg-slate-50/60">
                        <td colSpan={5} className="px-4 py-4">
                          {detailLoading ? (
                            <Loader text="Loading trip details..." />
                          ) : detailError ? (
                            <div className="text-red-600 text-sm">
                              {detailError}
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="bg-white border border-slate-200 rounded-xl p-4">
                                  <div className="text-xs uppercase tracking-wider text-slate-400 font-black mb-2">
                                    Receivables (Client)
                                  </div>
                                  {obligationsByGroup.receivable.map((ob) => (
                                    <div
                                      key={ob.id}
                                      className="border border-slate-100 rounded-lg p-3 mb-2"
                                    >
                                      <div className="flex justify-between items-center mb-2">
                                        <div className="font-bold text-slate-900">
                                          {ob.party_name || "Client"}
                                        </div>
                                        <button
                                          onClick={() =>
                                            openSettlementModal(ob)
                                          }
                                          className="text-xs inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#c7f135] text-[#10182a] font-bold"
                                        >
                                          <Plus className="w-3 h-3" /> Add
                                          Receipt
                                        </button>
                                      </div>
                                      <div className="text-xs text-slate-600">
                                        Expected:{" "}
                                        {currencyValue(
                                          symbol,
                                          ob.expected_amount,
                                        )}{" "}
                                        | Received:{" "}
                                        {currencyValue(
                                          symbol,
                                          ob.settled_amount,
                                        )}{" "}
                                        | Due:{" "}
                                        {currencyValue(
                                          symbol,
                                          Number(ob.expected_amount || 0) -
                                            Number(ob.settled_amount || 0),
                                        )}
                                      </div>
                                      <div className="mt-2 space-y-1">
                                        {(ob.settlements || [])
                                          .slice(0, 15)
                                          .map((s) => (
                                            <div
                                              key={s.id}
                                              className="text-xs flex justify-between items-center text-slate-600 bg-slate-50 border border-slate-100 rounded px-2 py-1.5"
                                            >
                                              <span className="pr-2">
                                                {formatSettlementDate(
                                                  s.settlement_date,
                                                )}{" "}
                                                | {s.settlement_type} |{" "}
                                                {currencyValue(
                                                  symbol,
                                                  s.amount,
                                                )}
                                              </span>
                                              <div className="flex items-center gap-2">
                                                <button
                                                  onClick={() =>
                                                    openEditSettlementModal(
                                                      ob,
                                                      s,
                                                    )
                                                  }
                                                  className="text-slate-500 hover:text-slate-700"
                                                  title="Edit settlement"
                                                >
                                                  <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                  onClick={() =>
                                                    handleDeleteSettlement(s.id)
                                                  }
                                                  className="text-red-500 hover:text-red-700"
                                                  title="Delete settlement"
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                              </div>
                                            </div>
                                          ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                <div className="bg-white border border-slate-200 rounded-xl p-4">
                                  <div className="text-xs uppercase tracking-wider text-slate-400 font-black mb-2">
                                    Payables (Hotels and Cabs)
                                  </div>
                                  {[
                                    ...obligationsByGroup.hotel,
                                    ...obligationsByGroup.cab,
                                    ...obligationsByGroup.otherPayables,
                                  ].map((ob) => (
                                    <div
                                      key={ob.id}
                                      className="border border-slate-100 rounded-lg p-3 mb-2"
                                    >
                                      <div className="flex justify-between items-center mb-2">
                                        <div className="font-bold text-slate-900">
                                          {ob.party_name || ob.party_type}
                                          <span className="ml-2 text-[10px] uppercase text-slate-500">
                                            {ob.party_type}
                                          </span>
                                        </div>
                                        <button
                                          onClick={() =>
                                            openSettlementModal(ob)
                                          }
                                          className="text-xs inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white font-bold"
                                        >
                                          <Plus className="w-3 h-3" /> Add
                                          Payment
                                        </button>
                                      </div>
                                      <div className="text-xs text-slate-600">
                                        Expected:{" "}
                                        {currencyValue(
                                          symbol,
                                          ob.expected_amount,
                                        )}{" "}
                                        | Paid:{" "}
                                        {currencyValue(
                                          symbol,
                                          ob.settled_amount,
                                        )}{" "}
                                        | Due:{" "}
                                        {currencyValue(
                                          symbol,
                                          Number(ob.expected_amount || 0) -
                                            Number(ob.settled_amount || 0),
                                        )}
                                      </div>
                                      <div className="mt-2 space-y-1">
                                        {(ob.settlements || [])
                                          .slice(0, 15)
                                          .map((s) => (
                                            <div
                                              key={s.id}
                                              className="text-xs flex justify-between items-center text-slate-600 bg-slate-50 border border-slate-100 rounded px-2 py-1.5"
                                            >
                                              <span>
                                                {formatSettlementDate(
                                                  s.settlement_date,
                                                )}{" "}
                                                | {s.settlement_type} |{" "}
                                                {currencyValue(
                                                  symbol,
                                                  s.amount,
                                                )}
                                              </span>
                                              <div className="flex items-center gap-2">
                                                <button
                                                  onClick={() =>
                                                    openEditSettlementModal(
                                                      ob,
                                                      s,
                                                    )
                                                  }
                                                  className="text-slate-500 hover:text-slate-700"
                                                  title="Edit settlement"
                                                >
                                                  <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                  onClick={() =>
                                                    handleDeleteSettlement(s.id)
                                                  }
                                                  className="text-red-500 hover:text-red-700"
                                                  title="Delete settlement"
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                              </div>
                                            </div>
                                          ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-500">
                    No rows found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <Pagination
        currentPage={pagination.current_page}
        lastPage={pagination.last_page}
        total={pagination.total}
        from={pagination.from}
        to={pagination.to}
        onPageChange={(page) => loadLedger(page)}
        pageSize={pagination.per_page}
        onPageSizeChange={handlePageSizeChange}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={closeSettlementModal}
        title="Settlement"
        isEditing={Boolean(editingSettlement)}
        submitting={saving}
        submitButtonText={submitButtonLabel}
        onSubmit={handleSaveSettlement}
      >
        <div className="space-y-4">
          {targetObligation && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4">
              <div className="flex justify-between items-center text-xs text-blue-800 font-bold uppercase tracking-wider">
                <span>Due Amount:</span>
                <span>
                  {currencyValue(
                    parseCurrencySymbol(tripDetail?.currency),
                    Number(targetObligation.expected_amount || 0) -
                      Number(targetObligation.settled_amount || 0),
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
              value={settlementForm.amount}
              onChange={(e) =>
                setSettlementForm((prev) => ({
                  ...prev,
                  amount: e.target.value,
                }))
              }
              className="mt-1 w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#c7f135]/20 transition-all"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
              Settlement Type
            </label>
            <select
              value={settlementForm.settlement_type}
              onChange={(e) =>
                setSettlementForm((prev) => ({
                  ...prev,
                  settlement_type: e.target.value,
                }))
              }
              className="mt-1 w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#c7f135]/20 transition-all"
            >
              {targetObligation?.direction === "receivable" ? (
                <option value="receipt">Receipt (Got from Client)</option>
              ) : (
                <option value="payment">Payment (Paid to Hotel/Cab)</option>
              )}
              <option value="refund">Refund (Returned money)</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
              Date
            </label>
            <DatePicker
              value={settlementForm.settlement_date}
              onChange={(val) =>
                setSettlementForm((prev) => ({
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
              value={settlementForm.method}
              onChange={(e) =>
                setSettlementForm((prev) => ({
                  ...prev,
                  method: e.target.value,
                }))
              }
              className="mt-1 w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#c7f135]/20 transition-all"
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
              value={settlementForm.notes}
              onChange={(e) =>
                setSettlementForm((prev) => ({
                  ...prev,
                  notes: e.target.value,
                }))
              }
              rows={3}
              className="mt-1 w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#c7f135]/20 transition-all placeholder:text-slate-300 shadow-sm"
              placeholder="Description for this transaction..."
            />
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
};

export default Ledger;
