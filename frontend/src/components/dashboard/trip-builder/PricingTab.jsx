import React from "react";
import { IndianRupee, Percent, Plus, Trash2 } from "lucide-react";

const PricingTab = ({
  totalHotelCost,
  totalVehicleCost,
  otherCosts,
  setOtherCosts,
  gstPercentage,
  setGstPercentage,
  profitMarginPercentage,
  setProfitMarginPercentage,
  calculatedTotalCost,
}) => {
  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
      <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center border border-blue-100">
            <IndianRupee className="w-5 h-5" />
          </div>
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">
            Cost Calculation
          </h3>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-slate-50/50 rounded-xl p-5 border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                Accommodation Total
              </span>
              <div className="text-xl font-black text-slate-900">
                ₹ {totalHotelCost.toLocaleString()}
              </div>
            </div>
            <div className="bg-slate-50/50 rounded-xl p-5 border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                Transportation Total
              </span>
              <div className="text-xl font-black text-slate-900">
                ₹ {totalVehicleCost.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center border border-blue-100">
                  <Plus className="w-5 h-5" />
                </div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">
                  Other Costs
                </h3>
              </div>
              <button
                onClick={() =>
                  setOtherCosts([
                    ...otherCosts,
                    { id: Date.now(), name: "", price: 0 },
                  ])
                }
                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-all"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {otherCosts.map((cost) => (
                <div key={cost.id} className="flex gap-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Cost Name"
                      value={cost.name}
                      onChange={(e) =>
                        setOtherCosts(
                          otherCosts.map((c) =>
                            c.id === cost.id
                              ? { ...c, name: e.target.value }
                              : c,
                          ),
                        )
                      }
                      className="w-full bg-slate-50 border border-slate-100 rounded-lg py-2 px-4 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#c7f135]/20 transition-all placeholder:text-slate-300 shadow-sm"
                    />
                  </div>
                  <div className="w-32">
                    <input
                      type="number"
                      placeholder="Price"
                      value={cost.price}
                      onChange={(e) =>
                        setOtherCosts(
                          otherCosts.map((c) =>
                            c.id === cost.id
                              ? { ...c, price: parseFloat(e.target.value) || 0 }
                              : c,
                          ),
                        )
                      }
                      className="w-full bg-slate-50 border border-slate-100 rounded-lg py-2 px-4 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#c7f135]/20 transition-all placeholder:text-slate-300 shadow-sm"
                    />
                  </div>
                  <button
                    onClick={() =>
                      setOtherCosts(otherCosts.filter((c) => c.id !== cost.id))
                    }
                    className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {otherCosts.length === 0 && (
                <p className="text-[10px] text-center text-slate-400 italic py-2">
                  No other costs added yet
                </p>
              )}
            </div>
          </div>

          <div className="p-6 bg-blue-50/30 rounded-xl border border-blue-100/50 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                  GST Percentage (%)
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Percent className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="number"
                    value={gstPercentage}
                    onChange={(e) =>
                      setGstPercentage(parseFloat(e.target.value) || 0)
                    }
                    className="w-full bg-white border border-slate-200 rounded-lg py-2.5 pl-10 pr-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#c7f135]/20 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                  Profit Margin (%)
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Percent className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="number"
                    value={profitMarginPercentage}
                    onChange={(e) =>
                      setProfitMarginPercentage(parseFloat(e.target.value) || 0)
                    }
                    className="w-full bg-white border border-slate-200 rounded-lg py-2.5 pl-10 pr-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#c7f135]/20 transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-blue-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] block mb-1">
                  Final Estimated Cost
                </span>
                <div className="text-3xl font-black text-blue-600">
                  ₹ {Math.round(calculatedTotalCost).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          <p className="text-[10px] font-bold text-slate-400 italic text-center px-4">
            * This cost is automatically updated in the "Trip Info" tab and will
            be used for the final quote.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PricingTab;
