import React, { useEffect, useMemo, useRef, useState } from "react";
import DashboardLayout from "./DashboardLayout";
import { TrendingUp, Receipt, Hotel, Car } from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import {
  fetchAccountingLedger,
  fetchAccountingTripLedger,
} from "../../api/accounting";
import Modal from "../common/Modal";
import { Eye } from "lucide-react";
import Loader from "../common/Loader";
import CompactDataTable from "../common/CompactDataTable";
import DateRangePicker from "./DateRangePicker";

// Date range filter state interface
const DEFAULT_DATE_RANGE = { start: null, end: null };

const normalizeDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

const isWithinRange = (dateValue, range) => {
  const date = normalizeDate(dateValue);
  if (!date) return false;

  // If range has no dates (All time), include everything
  if (!range.start && !range.end) return true;

  // Check if date is within the range
  if (range.start) {
    const startDate = normalizeDate(range.start);
    if (date < startDate) return false;
  }

  if (range.end) {
    const endDate = normalizeDate(range.end);
    if (date > endDate) return false;
  }

  return true;
};

const parseCurrencySymbol = (currency) => {
  if (!currency || typeof currency !== "string") return "INR ";
  const match = currency.match(/\((.*?)\)/);
  return match?.[1] || "INR ";
};

const currencyValue = (symbol, value) => {
  const n = Number(value || 0);
  return `${symbol}${n.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
};

const formatShortDate = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const AccountingSummary = () => {
  const { token } = useAuth();
  const [dateRange, setDateRange] = useState(DEFAULT_DATE_RANGE);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerRows, setLedgerRows] = useState([]);
  const [ledgerMeta, setLedgerMeta] = useState({
    total: 0,
    current_page: 1,
    last_page: 1,
  });
  const [activeTab, setActiveTab] = useState("hotels");
  const [vendorLoading, setVendorLoading] = useState(false);
  const [vendors, setVendors] = useState({ hotels: [], cabs: [] });
  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);

  useEffect(() => {
    if (!token) return;

    const loadLedgerSnapshot = async () => {
      try {
        setLedgerLoading(true);
        const resp = await fetchAccountingLedger(token, {
          page: 1,
          per_page: 100,
        });
        setLedgerRows(resp?.data || []);
        setLedgerMeta({
          total: resp?.total || 0,
          current_page: resp?.current_page || 1,
          last_page: resp?.last_page || 1,
        });
      } catch (err) {
        setLedgerRows([]);
        toast.error(err.message || "Failed to load accounting summary.");
      } finally {
        setLedgerLoading(false);
      }
    };

    loadLedgerSnapshot();
  }, [token]);

  useEffect(() => {
    // Initialize with today's date
    const today = new Date();
    setDateRange({ start: today, end: today });
  }, []);

  const filteredLedgerRows = useMemo(
    () => ledgerRows.filter((row) => isWithinRange(row.start_date, dateRange)),
    [ledgerRows, dateRange],
  );

  useEffect(() => {
    const loadVendors = async () => {
      if (!token) return;
      if (!filteredLedgerRows || filteredLedgerRows.length === 0) {
        setVendors({ hotels: [], cabs: [] });
        return;
      }

      try {
        setVendorLoading(true);
        const map = { hotels: new Map(), cabs: new Map() };

        // Fetch trip obligations in parallel (bounded to reasonable count via snapshot)
        const promises = filteredLedgerRows.map((t) =>
          fetchAccountingTripLedger(token, t.trip_id).catch((e) => null),
        );
        const details = await Promise.all(promises);

        details.forEach((detail, idx) => {
          if (!detail || !detail.obligations) return;
          const trip = filteredLedgerRows[idx];
          detail.obligations.forEach((obl) => {
            if (obl.direction !== "payable") return;
            const type = obl.party_type === "cab" ? "cabs" : "hotels";
            const key = `${obl.party_type}:${obl.party_id}`;
            const container = map[type];
            if (!container.has(key)) {
              container.set(key, {
                party_id: obl.party_id,
                party_name: obl.party_name || "Unknown",
                currency: detail.trip?.currency || trip.currency || "INR",
                expected_total: 0,
                settled_total: 0,
                trips: [],
              });
            }

            const item = container.get(key);
            const expected = Number(obl.expected_amount || 0);
            const settled = Number(obl.settled_amount || 0);
            item.expected_total += expected;
            item.settled_total += settled;

            // push trip-level info for drilldown
            item.trips.push({
              trip_id: detail.trip?.trip_id || trip.trip_id,
              trip_title: detail.trip?.trip_title || trip.trip_title,
              start_date: detail.trip?.start_date || trip.start_date,
              expected_amount: expected,
              settled_amount: settled,
            });
          });
        });

        const hotels = Array.from(map.hotels.values()).map((v) => ({
          ...v,
          trips_count: v.trips.length,
        }));
        const cabs = Array.from(map.cabs.values()).map((v) => ({
          ...v,
          trips_count: v.trips.length,
        }));

        setVendors({ hotels, cabs });
      } catch (err) {
        toast.error(err?.message || "Failed to load vendor aggregates.");
        setVendors({ hotels: [], cabs: [] });
      } finally {
        setVendorLoading(false);
      }
    };

    loadVendors();
  }, [filteredLedgerRows, token]);

  const totals = useMemo(
    () =>
      filteredLedgerRows.reduce(
        (acc, row) => {
          acc.receivableExpected += Number(row.receivable_expected || 0);
          acc.receivableRemaining += Number(row.receivable_remaining || 0);
          acc.payableExpected += Number(row.payable_expected || 0);
          acc.payableRemaining += Number(row.payable_remaining || 0);
          acc.hotelRemaining += Number(row.hotel_remaining || 0);
          acc.cabRemaining += Number(row.cab_remaining || 0);
          return acc;
        },
        {
          receivableExpected: 0,
          receivableRemaining: 0,
          payableExpected: 0,
          payableRemaining: 0,
          hotelRemaining: 0,
          cabRemaining: 0,
        },
      ),
    [filteredLedgerRows],
  );

  const summarySymbol = parseCurrencySymbol(filteredLedgerRows[0]?.currency);
  const currencySymbols = useMemo(
    () =>
      new Set(
        filteredLedgerRows.map((row) => parseCurrencySymbol(row.currency)),
      ),
    [filteredLedgerRows],
  );
  const hasMixedCurrencies = currencySymbols.size > 1;
  const netRemaining = totals.receivableRemaining - totals.payableRemaining;

  return (
    <DashboardLayout>
      <div className="mb-10">
        <h1 className="text-3xl font-black text-slate-900 leading-tight">
          Reports
        </h1>
        <p className="text-slate-400 font-medium mt-1">
          Revenue and expense overview with receivables and payables. Use the
          date picker to filter by custom date ranges.
        </p>
      </div>

      <div className="max-w-6xl">
        <div className="space-y-6 pb-12">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-500 font-medium">
              {filteredLedgerRows.length} trips in range
            </div>
            <DateRangePicker onApply={(range) => setDateRange(range)} />
          </div>
          {hasMixedCurrencies && filteredLedgerRows.length > 0 ? (
            <div className="text-xs text-amber-600 font-semibold">
              Totals include multiple currencies.
            </div>
          ) : null}
          {ledgerMeta.total > ledgerRows.length ? (
            <div className="text-xs text-slate-400">
              Showing the first {ledgerRows.length} trips. Visit the ledger for
              full details.
            </div>
          ) : null}

          {ledgerLoading ? (
            <div className="min-h-[40vh] flex items-center justify-center">
              <Loader text="Loading accounting summary..." />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Revenue
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900">
                    {currencyValue(summarySymbol, totals.receivableExpected)}
                  </div>
                  <div className="text-[11px] text-slate-400 font-medium">
                    Expected from clients
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Expenses
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900">
                    {currencyValue(summarySymbol, totals.payableExpected)}
                  </div>
                  <div className="text-[11px] text-slate-400 font-medium">
                    Expected to vendors
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Hotel className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Hotels Due
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900">
                    {currencyValue(summarySymbol, totals.hotelRemaining)}
                  </div>
                  <div className="text-[11px] text-slate-400 font-medium">
                    Unpaid hotel balances
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                      <Car className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Cabs Due
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900">
                    {currencyValue(summarySymbol, totals.cabRemaining)}
                  </div>
                  <div className="text-[11px] text-slate-400 font-medium">
                    Unpaid cab balances
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-4">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                      Vendors
                    </h3>
                    <p className="text-xs text-slate-400 font-medium mt-1">
                      Payables grouped by hotels and cabs for the selected
                      range.
                    </p>
                  </div>
                  <div className="text-xs font-bold text-slate-400">
                    Net: {currencyValue(summarySymbol, netRemaining)}
                  </div>
                </div>

                <div className="px-4 py-3 border-b border-slate-100 bg-white">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab("hotels")}
                      className={`px-3 py-2 rounded-md text-sm font-bold ${
                        activeTab === "hotels"
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      Hotels
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("cabs")}
                      className={`px-3 py-2 rounded-md text-sm font-bold ${
                        activeTab === "cabs"
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      Cabs
                    </button>
                  </div>
                </div>

                <CompactDataTable
                  headers={[
                    { label: "Vendor", className: "w-[40%]" },
                    "To Pay",
                    "Paid",
                    "Trips",
                    "Actions",
                  ]}
                  loading={vendorLoading}
                  hasRows={
                    (activeTab === "hotels" && vendors.hotels.length > 0) ||
                    (activeTab === "cabs" && vendors.cabs.length > 0)
                  }
                  colSpan={5}
                  emptyTitle={
                    vendorLoading ? "Loading..." : "No vendors in this range"
                  }
                  emptyDescription="Try a different filter to see results."
                  tableWrapClassName="overflow-x-auto"
                  tbodyClassName="divide-y divide-slate-50 text-xs font-medium [&_td]:!px-4 [&_td]:!py-4"
                >
                  {(activeTab === "hotels" ? vendors.hotels : vendors.cabs).map(
                    (v) => {
                      const symbol = parseCurrencySymbol(v.currency);
                      return (
                        <tr key={`${v.party_id}-${v.party_name}`}>
                          <td>
                            <div className="font-bold text-slate-900">
                              {v.party_name}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              ID: {v.party_id}
                            </div>
                          </td>
                          <td className="text-rose-600 font-semibold">
                            {currencyValue(symbol, v.expected_total)}
                          </td>
                          <td className="text-emerald-600 font-semibold">
                            {currencyValue(symbol, v.settled_total)}
                          </td>
                          <td className="text-slate-900 font-semibold">
                            {v.trips_count}
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedVendor(v);
                                setVendorModalOpen(true);
                              }}
                              className="p-2 rounded-md text-slate-600 hover:bg-slate-50"
                              aria-label="View vendor"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    },
                  )}
                </CompactDataTable>

                <Modal
                  isOpen={vendorModalOpen}
                  onClose={() => setVendorModalOpen(false)}
                  pureContent={true}
                >
                  <div className="bg-white rounded-2xl w-full max-w-2xl p-8 shadow-2xl">
                    <div className="mb-6">
                      <h2 className="text-xl font-black text-slate-900">
                        {selectedVendor?.party_name || "Vendor"}
                      </h2>
                      <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-wider">
                        Vendor Details
                      </p>
                    </div>
                    <div className="space-y-4">
                      <div className="text-sm text-slate-500">
                        Trips assigned: {selectedVendor?.trips_count || 0}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="text-slate-500 text-[11px]">
                            <tr>
                              <th className="py-2">Trip</th>
                              <th className="py-2">Date</th>
                              <th className="py-2">Paid</th>
                              <th className="py-2">Due</th>
                            </tr>
                          </thead>
                          <tbody className="text-slate-700">
                            {(selectedVendor?.trips || []).map((t) => {
                              const sym = parseCurrencySymbol(
                                selectedVendor?.currency,
                              );
                              const due =
                                Number(t.expected_amount || 0) -
                                Number(t.settled_amount || 0);
                              return (
                                <tr key={t.trip_id}>
                                  <td className="py-3 font-bold">
                                    {t.trip_id} — {t.trip_title}
                                  </td>
                                  <td className="py-3">
                                    {formatShortDate(t.start_date)}
                                  </td>
                                  <td className="py-3 text-emerald-600 font-semibold">
                                    {currencyValue(sym, t.settled_amount)}
                                  </td>
                                  <td className="py-3 text-rose-600 font-semibold">
                                    {currencyValue(sym, due)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </Modal>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AccountingSummary;
