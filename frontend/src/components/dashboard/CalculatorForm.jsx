import React, { useState, useEffect } from "react";
import DashboardLayout from "./DashboardLayout";
import {
  Calculator as CalculatorIcon,
  Hotel,
  Car,
  Users,
  Plus,
  Minus,
  Loader2,
  Percent,
  Download,
} from "lucide-react";
import { getHotels } from "../../api/hotels";
import { fetchVehicles } from "../../api/vehicles";
import {
  createCalculation,
  getCalculation,
  updateCalculation,
  downloadCalculationPdf,
} from "../../api/calculations";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";
import { useNavigate, useParams } from "react-router-dom";

const CalculatorForm = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  const [hotels, setHotels] = useState([]);
  const [vehicles, setVehicles] = useState([]);

  const [clientName, setClientName] = useState("");
  const [gstPercentage, setGstPercentage] = useState(5);
  const [profitMarginPercentage, setProfitMarginPercentage] = useState(10);

  const [selectedHotels, setSelectedHotels] = useState([
    {
      id: Date.now(),
      hotel: null,
      roomType: "deluxe",
      rooms: 1,
      nights: 1,
      cnbCount: 0,
      extraBeds5To12Count: 0,
      extraBedsAbove12Count: 0,
    },
  ]);

  const [selectedVehicles, setSelectedVehicles] = useState([
    {
      id: Date.now() + 1,
      vehicle: null,
      vehicleCount: 1,
      days: 1,
    },
  ]);

  const [otherCosts, setOtherCosts] = useState([
    {
      id: Date.now() + 2,
      name: "",
      price: 0,
    },
  ]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [hotelsResp, vehiclesResp] = await Promise.all([
          getHotels(token, { per_page: 100 }),
          fetchVehicles(token, { per_page: 100 }),
        ]);

        const fetchedHotels = hotelsResp.data || [];
        const fetchedVehicles = vehiclesResp.data || [];

        setHotels(fetchedHotels);
        setVehicles(fetchedVehicles);

        if (isEdit) {
          const calcResp = await getCalculation(token, id);
          const calc = calcResp; // Adjust based on your API structure (calcResp.data or calcResp)

          setClientName(calc.client_name);
          setGstPercentage(calc.gst_percentage);
          setProfitMarginPercentage(calc.profit_margin_percentage);

          // Restore selections
          if (calc.selected_hotels?.length > 0) {
            setSelectedHotels(
              calc.selected_hotels.map((h, idx) => {
                const hotel =
                  h.hotel || fetchedHotels.find((f) => f.id === h.hotel_id);
                return {
                  ...normalizeHotelSelection({
                    id: Date.now() + idx,
                    hotel: hotel || null,
                    roomType: h.roomType || "deluxe",
                    rooms: h.rooms,
                    nights: h.nights,
                    cnbCount: h.cnbCount ?? h.cnb_count,
                    extraBeds5To12Count:
                      h.extraBeds5To12Count ?? h.extra_beds_5_to_12_count,
                    extraBedsAbove12Count:
                      h.extraBedsAbove12Count ??
                      h.extra_beds_above_12_count,
                    extraBeds: h.extraBeds,
                    extraBedCategory: h.extraBedCategory || "5_to_12",
                  }),
                };
              }),
            );
          }

          if (calc.selected_vehicles?.length > 0) {
            setSelectedVehicles(
              calc.selected_vehicles.map((v, idx) => {
                const vehicle =
                  v.vehicle ||
                  fetchedVehicles.find((f) => f.id === v.vehicle_id);
                return {
                  id: Date.now() + 1000 + idx,
                  vehicle: vehicle || null,
                  vehicleCount: v.vehicleCount,
                  days: v.days,
                };
              }),
            );
          }

          if (calc.other_costs?.length > 0) {
            setOtherCosts(
              calc.other_costs.map((c, idx) => ({
                id: Date.now() + 2000 + idx,
                name: c.name,
                price: c.price,
              })),
            );
          }
        }
      } catch (error) {
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchData();
  }, [token, id, isEdit]);

  const handleSaveCalculation = async () => {
    if (!clientName) {
      toast.error("Please enter client name");
      return;
    }

    try {
      setSaving(true);

      const transformedHotels = selectedHotels
        .filter((h) => h.hotel)
        .map((h) => ({
          hotel_id: h.hotel.id,
          roomType: h.roomType,
          rooms: h.rooms,
          nights: h.nights,
          cnbCount: h.cnbCount || 0,
          extraBeds5To12Count: h.extraBeds5To12Count || 0,
          extraBedsAbove12Count: h.extraBedsAbove12Count || 0,
        }));

      const transformedVehicles = selectedVehicles
        .filter((v) => v.vehicle)
        .map((v) => ({
          vehicle_id: v.vehicle.id,
          vehicleCount: v.vehicleCount,
          days: v.days,
        }));

      const data = {
        client_name: clientName,
        selected_hotels: transformedHotels,
        selected_vehicles: transformedVehicles,
        other_costs: otherCosts.filter((c) => c.name && c.price > 0),
        gst_percentage: gstPercentage,
        profit_margin_percentage: profitMarginPercentage,
        total_cost: totalCost,
      };

      if (isEdit) {
        await updateCalculation(token, id, data);
        toast.success("Calculation updated!");
      } else {
        await createCalculation(token, data);
        toast.success("Calculation saved!");
      }
      navigate("/calculator");
    } catch (error) {
      toast.error("Failed to save calculation");
    } finally {
      setSaving(false);
    }
  };

  const addHotelSelection = () => {
    setSelectedHotels([
      ...selectedHotels,
      {
        id: Date.now(),
        hotel: null,
        roomType: "deluxe",
        rooms: 1,
        nights: 1,
        cnbCount: 0,
        extraBeds5To12Count: 0,
        extraBedsAbove12Count: 0,
      },
    ]);
  };

  const removeHotelSelection = (id) => {
    if (selectedHotels.length > 1)
      setSelectedHotels(selectedHotels.filter((h) => h.id !== id));
  };

  const updateHotelSelection = (id, updates) => {
    setSelectedHotels(
      selectedHotels.map((h) => (h.id === id ? { ...h, ...updates } : h)),
    );
  };

  const addVehicleSelection = () => {
    setSelectedVehicles([
      ...selectedVehicles,
      { id: Date.now(), vehicle: null, vehicleCount: 1, days: 1 },
    ]);
  };

  const removeVehicleSelection = (id) => {
    if (selectedVehicles.length > 1)
      setSelectedVehicles(selectedVehicles.filter((v) => v.id !== id));
  };

  const updateVehicleSelection = (id, updates) => {
    setSelectedVehicles(
      selectedVehicles.map((v) => (v.id === id ? { ...v, ...updates } : v)),
    );
  };

  const addOtherCost = () => {
    setOtherCosts([...otherCosts, { id: Date.now(), name: "", price: 0 }]);
  };

  const removeOtherCost = (id) => {
    if (otherCosts.length > 1)
      setOtherCosts(otherCosts.filter((c) => c.id !== id));
  };

  const updateOtherCost = (id, updates) => {
    setOtherCosts(
      otherCosts.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    );
  };

  const calculateHotelCost = (item) => {
    if (!item.hotel) return 0;
    const roomType = item.roomType || "deluxe";
    
    // Find matching price section or default to empty object
    const section = (item.hotel.price_sections || []).find((s) => s.room_type === roomType) || {};
    
    const basePrice = parseFloat(section.price || 0);
    const cnbPrice = parseFloat(section.cnb || 0);
    const extraBed5To12Price = parseFloat(section.upto_5 || 0);
    const extraBedAbove12Price = parseFloat(section.above_12 || 0);
    
    return (
      basePrice * item.rooms * item.nights +
      cnbPrice * (item.cnbCount || 0) * item.nights +
      extraBed5To12Price * (item.extraBeds5To12Count || 0) * item.nights +
      extraBedAbove12Price * (item.extraBedsAbove12Count || 0) * item.nights
    );
  };

  const getHotelCostBreakdown = (item) => {
    if (!item.hotel)
      return {
        roomTotal: 0,
        cnbTotal: 0,
        extraBed5To12Total: 0,
        extraBedAbove12Total: 0,
      };
      
    const roomType = item.roomType || "deluxe";
    const section = (item.hotel.price_sections || []).find((s) => s.room_type === roomType) || {};
    
    const basePrice = parseFloat(section.price || 0);
    const cnbPrice = parseFloat(section.cnb || 0);
    const extraBed5To12Price = parseFloat(section.upto_5 || 0);
    const extraBedAbove12Price = parseFloat(section.above_12 || 0);
    
    return {
      roomTotal: basePrice * item.rooms * item.nights,
      cnbTotal: cnbPrice * (item.cnbCount || 0) * item.nights,
      extraBed5To12Total:
        extraBed5To12Price * (item.extraBeds5To12Count || 0) * item.nights,
      extraBedAbove12Total:
        extraBedAbove12Price *
        (item.extraBedsAbove12Count || 0) *
        item.nights,
    };
  };

  const calculateVehicleCost = (item) => {
    if (!item.vehicle) return 0;
    return parseFloat(item.vehicle.price || 0) * item.vehicleCount * item.days;
  };

  const totalHotelCost = selectedHotels.reduce(
    (sum, item) => sum + calculateHotelCost(item),
    0,
  );
  const totalVehicleCost = selectedVehicles.reduce(
    (sum, item) => sum + calculateVehicleCost(item),
    0,
  );
  const totalOtherCost = otherCosts.reduce(
    (sum, item) => sum + parseFloat(item.price || 0),
    0,
  );

  const netCost = totalHotelCost + totalVehicleCost + totalOtherCost;
  const gstAmountValue = netCost * (gstPercentage / 100);
  const costWithGst = netCost + gstAmountValue;
  const totalCost = costWithGst * (1 + profitMarginPercentage / 100);

  const downloadPdf = async (calc) => {
    try {
      setDownloadingId("current");
      const blob = await downloadCalculationPdf(token, id || "preview");
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Pricing-Sheet-${calc.client_name || "Estimate"}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Failed to generate PDF");
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 leading-tight">
              {isEdit ? "Edit Calculation" : "New Calculation"}
            </h1>
            <p className="text-slate-400 font-medium mt-1">
              {isEdit
                ? "Update your trip estimate"
                : "Create a new trip estimate"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/calculator")}
              className="flex items-center gap-2 bg-slate-100 text-slate-600 px-6 py-3 rounded-2xl font-bold hover:bg-slate-200 transition-all text-sm w-fit"
            >
              Back to List
            </button>
            <button
              disabled={saving}
              onClick={handleSaveCalculation}
              className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-slate-800 transition-all text-sm w-fit shadow-lg shadow-slate-900/20 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {isEdit ? "Update Calculation" : "Save Calculation"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Client Info */}
          <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Client Information
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  Who is this calculation for?
                </p>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">
                Client Name
              </label>
              <input
                type="text"
                placeholder="Enter client or trip name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#c7f135]/20 transition-all"
              />
            </div>
          </div>

          <div className="space-y-6">
            {/* Settings */}
            <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center text-green-600">
                    <CalculatorIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Calculator Settings
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">
                      Configure GST and profit margin
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1.5">
                    <Percent className="w-3 h-3" /> GST (%)
                  </label>
                  <input
                    type="number"
                    value={gstPercentage}
                    onChange={(e) => setGstPercentage(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1.5">
                    <Percent className="w-3 h-3" /> Profit Margin (%)
                  </label>
                  <input
                    type="number"
                    value={profitMarginPercentage}
                    onChange={(e) =>
                      setProfitMarginPercentage(Number(e.target.value))
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Accommodation */}
            <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                    <Hotel className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Accommodation
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">
                      Add hotels and room details
                    </p>
                  </div>
                </div>
                <button
                  onClick={addHotelSelection}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-bold text-sm bg-blue-50 px-4 py-2 rounded-xl transition-all"
                >
                  <Plus className="w-4 h-4" /> Add Hotel
                </button>
              </div>

              <div className="space-y-10">
                {selectedHotels.map((item, index) => (
                  <div
                    key={item.id}
                    className={`${index > 0 ? "pt-10 border-t border-slate-50" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Hotel Selection {index + 1}
                      </span>
                      {selectedHotels.length > 1 && (
                        <button
                          onClick={() => removeHotelSelection(item.id)}
                          className="text-red-500 hover:text-red-600"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="space-y-6">
                      <select
                        className="w-full px-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#c7f135]/20 transition-all appearance-none"
                        value={item.hotel?.id || ""}
                        onChange={(e) => {
                          const hotel = hotels.find(
                            (h) => h.id === parseInt(e.target.value),
                          );
                          updateHotelSelection(item.id, {
                            hotel,
                            roomType: "deluxe",
                          });
                        }}
                      >
                        <option value="">Choose a hotel...</option>
                        {hotels.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name} - {h.city}
                          </option>
                        ))}
                      </select>
                      {item.hotel && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <div className="flex justify-between items-center">
                              <label className="text-[10px] font-black uppercase text-slate-400">
                                Room Type
                              </label>
                              <select
                                className="w-1/2 px-3 py-2 bg-slate-100 border-none rounded-xl text-xs font-bold text-slate-900"
                                value={item.roomType || "deluxe"}
                                onChange={(e) =>
                                  updateHotelSelection(item.id, {
                                    roomType: e.target.value,
                                  })
                                }
                              >
                                <option value="deluxe">Deluxe</option>
                                <option value="super_deluxe">
                                  Super Deluxe
                                </option>
                                <option value="suite">Suite</option>
                              </select>
                            </div>
                            <div className="flex justify-between items-center">
                              <label className="text-[10px] font-black uppercase text-slate-400">
                                Rooms
                              </label>
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() =>
                                    updateHotelSelection(item.id, {
                                      rooms: Math.max(1, item.rooms - 1),
                                    })
                                  }
                                  className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="font-black text-slate-900 w-4 text-center">
                                  {item.rooms}
                                </span>
                                <button
                                  onClick={() =>
                                    updateHotelSelection(item.id, {
                                      rooms: item.rooms + 1,
                                    })
                                  }
                                  className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            <div className="flex justify-between items-center">
                              <label className="text-[10px] font-black uppercase text-slate-400">
                                Nights
                              </label>
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() =>
                                    updateHotelSelection(item.id, {
                                      nights: Math.max(1, item.nights - 1),
                                    })
                                  }
                                  className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="font-black text-slate-900 w-4 text-center">
                                  {item.nights}
                                </span>
                                <button
                                  onClick={() =>
                                    updateHotelSelection(item.id, {
                                      nights: item.nights + 1,
                                    })
                                  }
                                  className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            <div className="flex justify-between items-center">
                              <label className="text-[10px] font-black uppercase text-slate-400">
                                CNB
                              </label>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() =>
                                    updateHotelSelection(item.id, {
                                      cnbCount: Math.max(0, (item.cnbCount || 0) - 1),
                                    })
                                  }
                                  className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200"
                                >
                                  <Minus className="w-3 h-3 text-slate-600" />
                                </button>
                                <span className="font-black text-slate-900 w-4 text-center">
                                  {item.cnbCount || 0}
                                </span>
                                <button
                                  onClick={() =>
                                    updateHotelSelection(item.id, {
                                      cnbCount: (item.cnbCount || 0) + 1,
                                    })
                                  }
                                  className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200"
                                >
                                  <Plus className="w-3 h-3 text-slate-600" />
                                </button>
                              </div>
                            </div>
                            <div className="flex justify-between items-center">
                              <label className="text-[10px] font-black uppercase text-slate-400">
                                Extra Beds (5 to 12)
                              </label>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() =>
                                      updateHotelSelection(item.id, {
                                        extraBeds5To12Count: Math.max(
                                          0,
                                          (item.extraBeds5To12Count || 0) - 1,
                                        ),
                                      })
                                    }
                                    className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200"
                                  >
                                    <Minus className="w-3 h-3 text-slate-600" />
                                  </button>
                                  <span className="font-black text-slate-900 w-4 text-center">
                                    {item.extraBeds5To12Count || 0}
                                  </span>
                                  <button
                                    onClick={() =>
                                      updateHotelSelection(item.id, {
                                        extraBeds5To12Count:
                                          (item.extraBeds5To12Count || 0) + 1,
                                      })
                                    }
                                    className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200"
                                  >
                                    <Plus className="w-3 h-3 text-slate-600" />
                                  </button>
                                </div>
                              </div>
                            </div>
                            <div className="flex justify-between items-center">
                              <label className="text-[10px] font-black uppercase text-slate-400">
                                Extra Beds (Above 12)
                              </label>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() =>
                                    updateHotelSelection(item.id, {
                                      extraBedsAbove12Count: Math.max(
                                        0,
                                        (item.extraBedsAbove12Count || 0) - 1,
                                      ),
                                    })
                                  }
                                  className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200"
                                >
                                  <Minus className="w-3 h-3 text-slate-600" />
                                </button>
                                <span className="font-black text-slate-900 w-4 text-center">
                                  {item.extraBedsAbove12Count || 0}
                                </span>
                                <button
                                  onClick={() =>
                                    updateHotelSelection(item.id, {
                                      extraBedsAbove12Count:
                                        (item.extraBedsAbove12Count || 0) + 1,
                                    })
                                  }
                                  className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200"
                                >
                                  <Plus className="w-3 h-3 text-slate-600" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Transportation */}
            <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-600">
                    <Car className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Transportation
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">
                      Add vehicles and duration
                    </p>
                  </div>
                </div>
                <button
                  onClick={addVehicleSelection}
                  className="flex items-center gap-2 text-orange-600 hover:text-orange-700 font-bold text-sm bg-orange-50 px-4 py-2 rounded-xl transition-all"
                >
                  <Plus className="w-4 h-4" /> Add Vehicle
                </button>
              </div>
              <div className="space-y-10">
                {selectedVehicles.map((item, index) => (
                  <div
                    key={item.id}
                    className={`${index > 0 ? "pt-10 border-t border-slate-50" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Vehicle {index + 1}
                      </span>
                      {selectedVehicles.length > 1 && (
                        <button
                          onClick={() => removeVehicleSelection(item.id)}
                          className="text-red-500 hover:text-red-600"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <select
                      className="w-full px-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 appearance-none mb-4"
                      value={item.vehicle?.id || ""}
                      onChange={(e) => {
                        const vehicle = vehicles.find(
                          (v) => v.id === parseInt(e.target.value),
                        );
                        updateVehicleSelection(item.id, { vehicle });
                      }}
                    >
                      <option value="">Choose a vehicle...</option>
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} - ₹{v.price}/day
                        </option>
                      ))}
                    </select>
                    {item.vehicle && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <label className="text-[10px] font-black uppercase text-slate-400">
                              Count
                            </label>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() =>
                                  updateVehicleSelection(item.id, {
                                    vehicleCount: Math.max(
                                      1,
                                      item.vehicleCount - 1,
                                    ),
                                  })
                                }
                                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="font-black text-slate-900 w-4 text-center">
                                {item.vehicleCount}
                              </span>
                              <button
                                onClick={() =>
                                  updateVehicleSelection(item.id, {
                                    vehicleCount: item.vehicleCount + 1,
                                  })
                                }
                                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <label className="text-[10px] font-black uppercase text-slate-400">
                              Days
                            </label>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() =>
                                  updateVehicleSelection(item.id, {
                                    days: Math.max(1, item.days - 1),
                                  })
                                }
                                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="font-black text-slate-900 w-4 text-center">
                                {item.days}
                              </span>
                              <button
                                onClick={() =>
                                  updateVehicleSelection(item.id, {
                                    days: item.days + 1,
                                  })
                                }
                                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Other Costs */}
            <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
                    <Plus className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Other Costs
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">
                      Add additional expenses
                    </p>
                  </div>
                </div>
                <button
                  onClick={addOtherCost}
                  className="flex items-center gap-2 text-purple-600 hover:text-purple-700 font-bold text-sm bg-purple-50 px-4 py-2 rounded-xl transition-all"
                >
                  <Plus className="w-4 h-4" /> Add Cost
                </button>
              </div>
              <div className="space-y-6">
                {otherCosts.map((item, index) => (
                  <div
                    key={item.id}
                    className={`${index > 0 ? "pt-6 border-t border-slate-50" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] font-black uppercase text-slate-400">
                        Item {index + 1}
                      </span>
                      {otherCosts.length > 1 && (
                        <button
                          onClick={() => removeOtherCost(item.id)}
                          className="text-red-500 hover:text-red-600"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input
                        type="text"
                        placeholder="Item Name"
                        value={item.name}
                        onChange={(e) =>
                          updateOtherCost(item.id, { name: e.target.value })
                        }
                        className="w-full px-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900"
                      />
                      <input
                        type="number"
                        placeholder="Price (₹)"
                        value={item.price}
                        onChange={(e) =>
                          updateOtherCost(item.id, {
                            price: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Summary Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white sticky top-8 shadow-2xl overflow-hidden">
            <h3 className="text-xl font-bold mb-8 relative z-10">
              Cost Summary
            </h3>
            <div className="space-y-6 mb-8 relative z-10">
              {/* Hotel Summary */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                  Accommodation
                </p>
                {selectedHotels
                  .filter((h) => h.hotel)
                  .map((h, i) => {
                    const breakdown = getHotelCostBreakdown(h);
                    const totalExtraBeds =
                      (h.cnbCount || 0) +
                      (h.extraBeds5To12Count || 0) +
                      (h.extraBedsAbove12Count || 0);
                    const extraBedTotal =
                      breakdown.cnbTotal +
                      breakdown.extraBed5To12Total +
                      breakdown.extraBedAbove12Total;
                    return (
                      <div key={i} className="mb-3 text-xs">
                        <p className="font-bold text-slate-300">
                          {h.hotel.name} ({h.roomType?.replace("_", " ")})
                        </p>
                        <div className="flex justify-between text-slate-500">
                          <span>
                            {h.rooms} rm × {h.nights} nt
                          </span>
                          <span>₹{breakdown.roomTotal.toLocaleString()}</span>
                        </div>
                        {totalExtraBeds > 0 && (
                          <div className="flex justify-between text-emerald-400/80 text-[10px]">
                            <span>
                              {h.extraBeds} Extra Bed × {h.nights} nt
                            </span>
                            <span>
                              + ₹{breakdown.extraBedTotal.toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>

              {/* Vehicle Summary */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                  Transportation
                </p>
                {selectedVehicles
                  .filter((v) => v.vehicle)
                  .map((v, i) => (
                    <div key={i} className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">
                        {v.vehicle.name} (x{v.vehicleCount})
                      </span>
                      <span className="text-slate-500">
                        ₹{calculateVehicleCost(v).toLocaleString()}
                      </span>
                    </div>
                  ))}
              </div>

              <div className="pt-6 border-t border-white/10 space-y-4">
                <div className="flex justify-between text-slate-400 text-xs uppercase font-black tracking-widest">
                  <span>Net Cost</span>
                  <span>₹{netCost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-400 text-xs uppercase font-black tracking-widest">
                  <span>GST ({gstPercentage}%)</span>
                  <span>₹{gstAmountValue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-blue-400/80 text-xs uppercase font-black tracking-widest">
                  <span>Margin ({profitMarginPercentage}%)</span>
                  <span>₹{(totalCost - costWithGst).toLocaleString()}</span>
                </div>
                <div className="pt-4 border-t border-white/10 flex justify-between items-center text-blue-400">
                  <span className="text-sm font-black uppercase tracking-widest">
                    Total Total
                  </span>
                  <p className="text-2xl font-black">
                    ₹
                    {totalCost.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CalculatorForm;
  const normalizeHotelSelection = (hotelSelection = {}) => {
    const legacyCategory = hotelSelection.extraBedCategory || "5_to_12";
    const legacyBeds = Number(hotelSelection.extraBeds || 0);

    return {
      ...hotelSelection,
      cnbCount:
        Number(hotelSelection.cnbCount ?? hotelSelection.cnb_count) ||
        (legacyCategory === "cnb" ? legacyBeds : 0),
      extraBeds5To12Count:
        Number(
          hotelSelection.extraBeds5To12Count ??
            hotelSelection.extra_beds_5_to_12_count,
        ) || (legacyCategory === "5_to_12" ? legacyBeds : 0),
      extraBedsAbove12Count:
        Number(
          hotelSelection.extraBedsAbove12Count ??
            hotelSelection.extra_beds_above_12_count,
        ) || (legacyCategory === "above_12" ? legacyBeds : 0),
    };
  };
