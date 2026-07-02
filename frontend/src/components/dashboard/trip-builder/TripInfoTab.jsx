import React from "react";
import { PhoneInput } from "react-international-phone";
import {
  CheckCircle,
  IndianRupee,
  Minus,
  Pencil,
  Plus,
  Settings as SettingsIcon,
  Trash2,
  Users,
  X,
} from "lucide-react";
import DatePicker from "../../common/DatePicker";

const TripInfoTab = ({
  tripInfo,
  setTripInfo,
  urlTripId,
  hotelForm,
  setHotelForm,
  transportForm,
  setTransportForm,
  calculatedTotalCost,
  includeGST,
  setIncludeGST,
  navigate,
  standardInclusions,
  inclusions,
  setInclusions,
  newInclusion,
  setNewInclusion,
  addInclusion,
  editingInclusionIndex,
  setEditingInclusionIndex,
  editingInclusionValue,
  setEditingInclusionValue,
  saveInclusionEdit,
  removeInclusion,
  standardExclusions,
  exclusions,
  setExclusions,
  newExclusion,
  setNewExclusion,
  addExclusion,
  editingExclusionIndex,
  setEditingExclusionIndex,
  editingExclusionValue,
  setEditingExclusionValue,
  saveExclusionEdit,
  removeExclusion,
}) => {
  const resolvedTemplate =
    tripInfo.template === "ClassicTemplate"
      ? "ClassicTemplate"
      : "ModernTemplate";
  const isModernTemplate = resolvedTemplate === "ModernTemplate";

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div>
        <label className="block text-[11px] font-semibold text-[#10182a]/45 uppercase tracking-[0.12em] mb-1.5">
          Trip ID (Auto)
        </label>
        <input
          type="text"
          value={tripInfo.tripId}
          readOnly
          className="w-full bg-[#f3f3f4] border border-black/10 rounded-lg py-2 px-3.5 text-xs font-bold text-[#9aa3b2] focus:outline-none transition-all cursor-not-allowed"
        />
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-[#10182a]/45 uppercase tracking-[0.12em] mb-1.5 leading-none">
          TEMPLATE STYLE
        </label>
        <select
          value={resolvedTemplate}
          onChange={(e) =>
            setTripInfo({
              ...tripInfo,
              template: e.target.value,
            })
          }
          className="w-full bg-white border border-black/10 rounded-xl py-2.5 px-4 text-sm font-medium text-[#10182a] focus:outline-none focus:ring-2 focus:ring-[#c7f135]/20 transition-all"
        >
          <option value="ModernTemplate">Modern Elegant</option>
          <option value="ClassicTemplate">Classic Professional</option>
        </select>
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-[#10182a]/45 uppercase tracking-[0.12em] mb-1.5">
          Trip Title
        </label>
        <input
          type="text"
          placeholder="e.g. Summer in Italy"
          value={tripInfo.tripTitle}
          onChange={(e) =>
            setTripInfo({
              ...tripInfo,
              tripTitle: e.target.value,
            })
          }
          className="w-full bg-white border border-black/10 rounded-xl py-2.5 px-4 text-sm font-medium text-[#10182a] focus:outline-none focus:ring-2 focus:ring-[#c7f135]/20 transition-all placeholder:text-[#c9ced6]"
        />
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-[#10182a]/45 uppercase tracking-[0.12em] mb-1.5">
          Destination
        </label>
        <input
          type="text"
          placeholder="e.g. Paris, Tokyo, Bali"
          value={tripInfo.destination}
          onChange={(e) =>
            setTripInfo({
              ...tripInfo,
              destination: e.target.value,
            })
          }
          className="w-full bg-white border border-black/10 rounded-xl py-2.5 px-4 text-sm font-medium text-[#10182a] focus:outline-none focus:ring-2 focus:ring-[#c7f135]/20 transition-all placeholder:text-[#c9ced6]"
        />
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-[#10182a]/45 uppercase tracking-[0.12em] mb-1.5">
          Client Name
        </label>
        <input
          type="text"
          placeholder="e.g. John Doe"
          value={tripInfo.clientName}
          onChange={(e) =>
            setTripInfo({
              ...tripInfo,
              clientName: e.target.value,
            })
          }
          className="w-full bg-white border border-black/10 rounded-xl py-2.5 px-4 text-sm font-medium text-[#10182a] focus:outline-none focus:ring-2 focus:ring-[#c7f135]/20 transition-all placeholder:text-[#c9ced6]"
        />
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-[#10182a]/45 uppercase tracking-[0.12em] mb-1.5">
          Client Phone <span className="text-red-500">*</span>
        </label>
        <div className="phone-input-container">
          <PhoneInput
            defaultCountry="in"
            value={tripInfo.clientPhone}
            onChange={(phone) =>
              setTripInfo({
                ...tripInfo,
                clientPhone: phone,
              })
            }
            className="w-full"
            inputClassName="!w-full !bg-white !border-black/10 !rounded-lg !py-5 !px-3.5 !text-xs !font-bold !text-[#10182a] !focus:outline-none !focus:ring-2 !focus:ring-[#c7f135]/20 !transition-all !placeholder:text-[#c9ced6]"
          />
        </div>
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-[#10182a]/45 uppercase tracking-[0.12em] mb-1.5">
          Client Email
        </label>
        <input
          type="email"
          placeholder="e.g. john.doe@example.com"
          value={tripInfo.clientEmail}
          onChange={(e) =>
            setTripInfo({
              ...tripInfo,
              clientEmail: e.target.value,
            })
          }
          className="w-full bg-white border border-black/10 rounded-xl py-2.5 px-4 text-sm font-medium text-[#10182a] focus:outline-none focus:ring-2 focus:ring-[#c7f135]/20 transition-all placeholder:text-[#c9ced6]"
        />
      </div>

      <div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#f3f3f4] p-3 rounded-lg border border-black/5">
            <label className="text-[11px] font-semibold text-[#10182a]/45 uppercase tracking-[0.12em] mb-2 flex items-center gap-2">
              <Users className="w-3 h-3 text-[#10182a]" />
              Number of Adults
            </label>
            <div className="flex items-center justify-between bg-white rounded-md border border-black/10 p-1">
              <button
                type="button"
                onClick={() => {
                  const newVal = Math.max(1, (tripInfo.adults || 0) - 1);
                  setTripInfo({
                    ...tripInfo,
                    adults: newVal,
                  });
                }}
                className="w-8 h-8 rounded-md bg-[#f3f3f4] flex items-center justify-center hover:bg-[#eef0f1] text-[#5b6472] transition-colors"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="font-bold text-[#10182a] text-sm">
                {tripInfo.adults || 2}
              </span>
              <button
                type="button"
                onClick={() => {
                  const newVal = (tripInfo.adults || 0) + 1;
                  setTripInfo({
                    ...tripInfo,
                    adults: newVal,
                  });
                }}
                className="w-8 h-8 rounded-md bg-[#f3f3f4] flex items-center justify-center hover:bg-[#eef0f1] text-[#5b6472] transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="bg-[#f3f3f4] p-3 rounded-lg border border-black/5">
            <label className="text-[11px] font-semibold text-[#10182a]/45 uppercase tracking-[0.12em] mb-2 flex items-center gap-2">
              <Users className="w-3 h-3 text-orange-500" />
              Kids
            </label>
            <div className="flex items-center justify-between bg-white rounded-md border border-black/10 p-1">
              <button
                type="button"
                onClick={() => {
                  const newVal = Math.max(0, (tripInfo.kids5to12 || 0) - 1);
                  setTripInfo({
                    ...tripInfo,
                    kids5to12: newVal,
                  });
                }}
                className="w-8 h-8 rounded-md bg-[#f3f3f4] flex items-center justify-center hover:bg-[#eef0f1] text-[#5b6472] transition-colors"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="font-bold text-[#10182a] text-sm">
                {tripInfo.kids5to12 || 0}
              </span>
              <button
                type="button"
                onClick={() => {
                  const newVal = (tripInfo.kids5to12 || 0) + 1;
                  setTripInfo({
                    ...tripInfo,
                    kids5to12: newVal,
                  });
                }}
                className="w-8 h-8 rounded-md bg-[#f3f3f4] flex items-center justify-center hover:bg-[#eef0f1] text-[#5b6472] transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-[#10182a]/45 uppercase tracking-[0.12em] mb-1.5">
          Start Date
        </label>
        <div className="relative">
          <DatePicker
            value={tripInfo.startDate}
            minDate="today"
            onChange={(dateString) => {
              setTripInfo({
                ...tripInfo,
                startDate: dateString,
              });
              if (dateString) {
                if (!hotelForm.checkIn) {
                  setHotelForm((prev) => ({
                    ...prev,
                    checkIn: dateString,
                    checkOut: prev.checkOut || dateString,
                  }));
                }
                if (!transportForm.date) {
                  setTransportForm((prev) => ({
                    ...prev,
                    date: dateString,
                  }));
                }
              }
            }}
            className="w-full"
            options={{
              dateFormat: "d-m-Y",
              minDate: urlTripId ? null : "today",
            }}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-[11px] font-semibold text-[#10182a]/45 uppercase tracking-[0.12em] mb-1.5 ml-1">
            Duration (Nights)
          </label>
          <div className="relative">
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#9aa3b2]">
              / {parseInt(tripInfo.duration || 0) + 1} Days
            </span>
            <input
              type="number"
              min="0"
              value={tripInfo.duration}
              onChange={(e) =>
                setTripInfo({
                  ...tripInfo,
                  duration: e.target.value,
                })
              }
              className="w-full bg-white border border-black/10 rounded-xl py-2.5 px-4 text-sm font-medium text-[#10182a] focus:outline-none focus:ring-2 focus:ring-[#c7f135]/20 transition-all shadow-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between items-center mb-1.5 ml-1">
              <label className="block text-[11px] font-semibold text-[#10182a]/45 uppercase tracking-[0.12em] shrink-0">
                Trip Cost
              </label>
              {calculatedTotalCost > 0 && (
                <span className="text-[9px] font-bold text-[#6f8f00] uppercase tracking-tighter bg-[#eef9c2] px-1.5 py-0.5 rounded leading-none">
                  Auto-calculated
                </span>
              )}
            </div>
            <div className="relative group">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9aa3b2] group-focus-within:text-[#10182a] transition-colors">
                <IndianRupee className="w-3.5 h-3.5" />
              </div>
              <input
                type="number"
                min="0"
                value={tripInfo.cost}
                onChange={(e) =>
                  setTripInfo({
                    ...tripInfo,
                    cost: e.target.value,
                  })
                }
                className="w-full bg-white border border-black/10 rounded-lg py-2.5 pl-10 pr-4 text-sm font-bold text-[#10182a] focus:outline-none focus:ring-2 focus:ring-[#c7f135]/20 transition-all shadow-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#10182a]/45 uppercase tracking-[0.12em] mb-1.5 ml-1">
              Currency
            </label>
            <input
              type="text"
              value={tripInfo.currency}
              onChange={(e) =>
                setTripInfo({
                  ...tripInfo,
                  currency: e.target.value,
                })
              }
              className="w-full bg-white border border-black/10 rounded-xl py-2.5 px-4 text-sm font-medium text-[#10182a] focus:outline-none focus:ring-2 focus:ring-[#c7f135]/20 transition-all shadow-sm"
            />
          </div>
        </div>

        {isModernTemplate && (
          <div>
            <label className="block text-[11px] font-semibold text-[#10182a]/45 uppercase tracking-[0.12em] mb-1.5 ml-1">
              Banner Tagline
            </label>
            <textarea
              rows={3}
              value={tripInfo.tagline}
              onChange={(e) =>
                setTripInfo({
                  ...tripInfo,
                  tagline: e.target.value,
                })
              }
              placeholder="e.g. BOOK VERIFIED HOTELS, CABS..."
              className="w-full bg-white border border-black/10 rounded-lg py-2.5 px-4 text-xs font-bold text-[#10182a] focus:outline-none focus:ring-2 focus:ring-[#c7f135]/20 transition-all shadow-sm min-h-21 resize-none"
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="includeGST"
          checked={includeGST}
          onChange={(e) => setIncludeGST(e.target.checked)}
          className="w-4 h-4 text-[#10182a] bg-gray-100 border-gray-300 rounded focus:ring-[#c7f135] focus:ring-2"
        />
        <label
          htmlFor="includeGST"
          className="text-[11px] font-semibold text-[#10182a]/45 uppercase tracking-[0.12em] cursor-pointer"
        >
          Include GST in Quote
        </label>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="useFlight"
          checked={tripInfo.useFlight || false}
          onChange={(e) =>
            setTripInfo({
              ...tripInfo,
              useFlight: e.target.checked,
            })
          }
          className="w-4 h-4 text-[#10182a] bg-gray-100 border-gray-300 rounded focus:ring-[#c7f135] focus:ring-2"
        />
        <label
          htmlFor="useFlight"
          className="text-[11px] font-semibold text-[#10182a]/45 uppercase tracking-[0.12em] cursor-pointer"
        >
          Are we using Flight / Bus / Train?
        </label>
      </div>

      {tripInfo.useFlight && (
        <div className="bg-[#f3f3f4]/50 p-4 rounded-lg space-y-4 border border-black/5/50">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[10px] font-semibold text-[#10182a] uppercase tracking-widest">
              Transport Logistics
            </h4>
            <button
              type="button"
              onClick={() => {
                setTripInfo({
                  ...tripInfo,
                  transportDetails: [
                    ...(tripInfo.transportDetails || []),
                    {
                      id: Date.now(),
                      transportType: "Flight",
                      airline: "",
                      flightNumber: "",
                      departureDateTime: "",
                      arrivalDateTime: "",
                      departureLocation: "",
                      arrivalLocation: "",
                      pnrNumber: "",
                      travelerNames: [],
                    },
                  ],
                });
              }}
              className="text-[10px] font-semibold text-[#10182a] uppercase tracking-widest hover:text-[#10182a] transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3 h-3" />
              Add Ticket
            </button>
          </div>

          <div className="space-y-4">
            {(tripInfo.transportDetails || []).map((transport, index) => (
              <div
                key={transport.id || index}
                className="bg-white rounded-lg p-4 border border-black/5 relative group"
              >
                <button
                  type="button"
                  onClick={() => {
                    const newDetails = [...tripInfo.transportDetails];
                    newDetails.splice(index, 1);
                    setTripInfo({
                      ...tripInfo,
                      transportDetails: newDetails,
                    });
                  }}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-50 text-red-500 rounded-full flex items-center justify-center border border-red-100 transition-all hover:bg-red-500 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-[11px] font-semibold text-[#10182a]/45 uppercase tracking-[0.12em] mb-1.5 leading-none">
                      Type
                    </label>
                    <select
                      value={transport.transportType}
                      onChange={(e) => {
                        const newDetails = [...tripInfo.transportDetails];
                        newDetails[index].transportType = e.target.value;
                        setTripInfo({
                          ...tripInfo,
                          transportDetails: newDetails,
                        });
                      }}
                      className="w-full bg-white border border-black/10 rounded-xl py-2.5 px-4 text-sm font-medium text-[#10182a] focus:outline-none focus:ring-2 focus:ring-[#c7f135]/20 transition-all shadow-sm"
                    >
                      <option value="Flight">Flight</option>
                      <option value="Bus">Bus</option>
                      <option value="Train">Train</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#10182a]/45 uppercase tracking-[0.12em] mb-1.5 leading-none">
                      Departure
                    </label>
                    <DatePicker
                      enableTime={true}
                      value={transport.departureDateTime}
                      onChange={(dateString) => {
                        const newDetails = [...tripInfo.transportDetails];
                        newDetails[index].departureDateTime =
                          dateString.replace(" ", "T");
                        setTripInfo({
                          ...tripInfo,
                          transportDetails: newDetails,
                        });
                      }}
                      className="w-full"
                      options={{
                        dateFormat: "d-m-Y H:i",
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#10182a]/45 uppercase tracking-[0.12em] mb-1.5 leading-none">
                      Arrival
                    </label>
                    <DatePicker
                      enableTime={true}
                      value={transport.arrivalDateTime}
                      onChange={(dateString) => {
                        const newDetails = [...tripInfo.transportDetails];
                        newDetails[index].arrivalDateTime = dateString.replace(
                          " ",
                          "T",
                        );
                        setTripInfo({
                          ...tripInfo,
                          transportDetails: newDetails,
                        });
                      }}
                      className="w-full"
                      options={{
                        dateFormat: "d-m-Y H:i",
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#10182a]/45 uppercase tracking-[0.12em] mb-1.5 leading-none">
                      {transport.transportType === "Flight"
                        ? "Airline"
                        : transport.transportType === "Bus"
                          ? "Company"
                          : "Train"}
                    </label>
                    <input
                      type="text"
                      value={transport.airline}
                      onChange={(e) => {
                        const newDetails = [...tripInfo.transportDetails];
                        newDetails[index].airline = e.target.value;
                        setTripInfo({
                          ...tripInfo,
                          transportDetails: newDetails,
                        });
                      }}
                      placeholder="e.g. Indigo"
                      className="w-full bg-white border border-black/10 rounded-xl py-2.5 px-4 text-sm font-medium text-[#10182a] focus:outline-none focus:ring-2 focus:ring-[#c7f135]/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#10182a]/45 uppercase tracking-[0.12em] mb-1.5 leading-none">
                      {transport.transportType === "Flight"
                        ? "Flight #"
                        : "Number #"}
                    </label>
                    <input
                      type="text"
                      value={transport.flightNumber}
                      onChange={(e) => {
                        const newDetails = [...tripInfo.transportDetails];
                        newDetails[index].flightNumber = e.target.value;
                        setTripInfo({
                          ...tripInfo,
                          transportDetails: newDetails,
                        });
                      }}
                      placeholder="Number"
                      className="w-full bg-white border border-black/10 rounded-xl py-2.5 px-4 text-sm font-medium text-[#10182a] focus:outline-none focus:ring-2 focus:ring-[#c7f135]/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#10182a]/45 uppercase tracking-[0.12em] mb-1.5 leading-none">
                      From
                    </label>
                    <input
                      type="text"
                      value={transport.departureLocation}
                      onChange={(e) => {
                        const newDetails = [...tripInfo.transportDetails];
                        newDetails[index].departureLocation = e.target.value;
                        setTripInfo({
                          ...tripInfo,
                          transportDetails: newDetails,
                        });
                      }}
                      placeholder="ABC"
                      className="w-full bg-white border border-black/10 rounded-xl py-2.5 px-4 text-sm font-medium text-[#10182a] focus:outline-none focus:ring-2 focus:ring-[#c7f135]/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#10182a]/45 uppercase tracking-[0.12em] mb-1.5 leading-none">
                      To
                    </label>
                    <input
                      type="text"
                      value={transport.arrivalLocation}
                      onChange={(e) => {
                        const newDetails = [...tripInfo.transportDetails];
                        newDetails[index].arrivalLocation = e.target.value;
                        setTripInfo({
                          ...tripInfo,
                          transportDetails: newDetails,
                        });
                      }}
                      placeholder="XYZ"
                      className="w-full bg-white border border-black/10 rounded-xl py-2.5 px-4 text-sm font-medium text-[#10182a] focus:outline-none focus:ring-2 focus:ring-[#c7f135]/20 transition-all"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] font-semibold text-[#10182a]/45 uppercase tracking-[0.12em] mb-1.5 leading-none">
                      PNR Number
                    </label>
                    <input
                      type="text"
                      value={transport.pnrNumber}
                      onChange={(e) => {
                        const newDetails = [...tripInfo.transportDetails];
                        newDetails[index].pnrNumber = e.target.value;
                        setTripInfo({
                          ...tripInfo,
                          transportDetails: newDetails,
                        });
                      }}
                      placeholder="PNR"
                      className="w-full bg-white border border-black/10 rounded-xl py-2.5 px-4 text-sm font-medium text-[#10182a] focus:outline-none focus:ring-2 focus:ring-[#c7f135]/20 transition-all"
                    />
                  </div>
                  <div className="col-span-2 pt-2 border-t border-black/5">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-[9px] font-semibold text-[#9aa3b2] uppercase tracking-widest leading-none">
                        Traveler Names
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const newDetails = [...tripInfo.transportDetails];
                          newDetails[index].travelerNames = [
                            ...(newDetails[index].travelerNames || []),
                            "",
                          ];
                          setTripInfo({
                            ...tripInfo,
                            transportDetails: newDetails,
                          });
                        }}
                        className="text-[9px] font-semibold text-[#10182a] uppercase tracking-widest hover:text-[#10182a]"
                      >
                        + Add Traveler
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(transport.travelerNames || []).map((tName, tIdx) => (
                        <div key={tIdx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={tName}
                            onChange={(e) => {
                              const newDetails = [...tripInfo.transportDetails];
                              newDetails[index].travelerNames[tIdx] =
                                e.target.value;
                              setTripInfo({
                                ...tripInfo,
                                transportDetails: newDetails,
                              });
                            }}
                            placeholder="Name"
                            className="flex-1 bg-white border border-black/10 rounded-md py-1.5 px-3 text-[10px] font-bold text-[#10182a] focus:outline-none focus:ring-2 focus:ring-[#c7f135]/20 transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newDetails = [...tripInfo.transportDetails];
                              newDetails[index].travelerNames.splice(tIdx, 1);
                              setTripInfo({
                                ...tripInfo,
                                transportDetails: newDetails,
                              });
                            }}
                            className="text-red-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {(!tripInfo.transportDetails ||
              tripInfo.transportDetails.length === 0) && (
              <div className="text-center py-4 border-2 border-dashed border-black/5 rounded-lg bg-white/50">
                <p className="text-[9px] font-bold text-[#9aa3b2] uppercase tracking-widest">
                  No tickets added yet.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <label className="block text-[11px] font-semibold text-[#10182a]/45 uppercase tracking-[0.12em]">
            Trip Visuals
          </label>
          <button
            onClick={() => navigate("/settings")}
            className="bg-[#f3f3f4] text-[#1b1b1b] px-3 py-1.5 rounded-full text-[9px] font-semibold uppercase tracking-widest flex items-center gap-1.5 hover:bg-[#eef9c2]/50 transition-all"
          >
            <SettingsIcon className="w-3 h-3 text-[#9aa3b2]" />
            Manage Branding
          </button>
        </div>

        <div className="space-y-3">
          <div className="space-y-2.5">
            <p className="text-[10px] font-bold text-[#9aa3b2]">Cover Image</p>
            <div className="flex items-center gap-3 text-[11px]">
              <input
                type="file"
                id="coverImageInput"
                className="hidden"
                accept=".jpg,.jpeg,.png,.webp"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setTripInfo({
                        ...tripInfo,
                        image: reader.result,
                      });
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
              <button
                onClick={() =>
                  document.getElementById("coverImageInput").click()
                }
                className="bg-[#f3f3f4] text-[#1b1b1b] px-5 py-2.5 rounded-full font-semibold hover:bg-[#eef9c2]/80 transition-all"
              >
                Choose File
              </button>
              <span className="text-[#9aa3b2] font-bold truncate max-w-37.5">
                {tripInfo.image
                  ? tripInfo.image.startsWith("data:")
                    ? "Custom image selected"
                    : "Saved image"
                  : "Default image"}
              </span>
            </div>
            <p className="text-[10px] font-bold text-[#9aa3b2]">
              Accepted formats: JPG, JPEG, PNG, WebP
            </p>
          </div>

          <div className="bg-[#f9f9f9] border border-black/5 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-[#10182a] mb-0.5">
              TravelAgency
            </h4>
            <p className="text-[9px] font-bold text-[#9aa3b2]">
              Branding applied from Global Settings
            </p>
          </div>
        </div>

        <div className="pt-4 space-y-4 border-t border-black/5">
          <label className="block text-[11px] font-semibold text-[#10182a]/45 uppercase tracking-[0.12em]">
            Trip Inclusions
          </label>
          <p className="text-[10px] text-[#9aa3b2]">
            Default inclusions can be managed from the{" "}
            <a
              href="/policies"
              className="text-[#10182a] hover:underline font-semibold"
            >
              Policies page
            </a>
            .
          </p>

          <div className="space-y-1">
            <select
              onChange={(e) => {
                const val = e.target.value;
                if (val) {
                  const isAdded = inclusions.some((i) => i.content === val);
                  if (!isAdded) {
                    setInclusions([...inclusions, { content: val }]);
                  }
                }
                e.target.value = "";
              }}
              className="w-full bg-[#f3f3f4] border border-black/10 rounded-lg py-2 px-3 text-[11px] font-bold text-[#3a4250] focus:outline-none focus:ring-2 focus:ring-[#c7f135]/10 transition-all cursor-pointer"
            >
              <option value="">+ Add standard inclusion...</option>
              {standardInclusions.map((item, idx) => (
                <option
                  key={idx}
                  value={item}
                  disabled={inclusions.some((i) => i.content === item)}
                >
                  {inclusions.some((i) => i.content === item) ? "✓ " : ""}
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add custom inclusion..."
              value={newInclusion}
              onChange={(e) => setNewInclusion(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && addInclusion()}
              className="flex-1 bg-white border border-black/10 rounded-xl py-2.5 px-4 text-sm font-medium text-[#10182a] focus:outline-none focus:ring-2 focus:ring-[#c7f135]/20 transition-all placeholder:text-[#c9ced6]"
            />
            <button
              onClick={addInclusion}
              className="bg-[#c7f135] text-[#10182a] p-2 rounded-lg hover:bg-[#b0dc00] transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2 max-h-50 overflow-y-auto pr-1 mt-4">
            {inclusions.map((item, index) => (
              <div
                key={index}
                className="group flex items-center justify-between bg-white border border-black/5 p-2.5 rounded-lg transition-all hover:border-black/5 hover:shadow-sm"
              >
                {editingInclusionIndex === index ? (
                  <>
                    <input
                      autoFocus
                      type="text"
                      value={editingInclusionValue}
                      onChange={(e) => setEditingInclusionValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveInclusionEdit(index);
                        if (e.key === "Escape") setEditingInclusionIndex(null);
                      }}
                      className="flex-1 text-[11px] font-medium text-[#3a4250] bg-transparent border-none focus:ring-0 outline-none"
                    />
                    <div className="flex gap-1 ml-2 shrink-0">
                      <button
                        onClick={() => saveInclusionEdit(index)}
                        className="text-white bg-[#c7f135] hover:bg-[#b0dc00] p-1 rounded-md transition-colors"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingInclusionIndex(null)}
                        className="text-[#9aa3b2] hover:text-[#5b6472] hover:bg-[#eef0f1] p-1 rounded-md transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-[11px] font-medium text-[#5b6472] flex-1">
                      {item.content}
                    </span>
                    <div className="flex gap-1 ml-2 shrink-0">
                      <button
                        onClick={() => {
                          setEditingInclusionIndex(index);
                          setEditingInclusionValue(item.content);
                        }}
                        className="text-[#c9ced6] hover:text-[#10182a] transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => removeInclusion(index)}
                        className="text-[#c9ced6] hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {inclusions.length === 0 && (
              <p className="text-[10px] text-center text-[#9aa3b2] italic py-2">
                No inclusions added yet
              </p>
            )}
          </div>
        </div>

        <div className="pt-4 space-y-4 border-t border-black/5">
          <label className="block text-[11px] font-semibold text-[#10182a]/45 uppercase tracking-[0.12em]">
            Trip Exclusions
          </label>
          <p className="text-[10px] text-[#9aa3b2]">
            Default exclusions can be managed from the{" "}
            <a
              href="/policies"
              className="text-[#10182a] hover:underline font-semibold"
            >
              Policies page
            </a>
            .
          </p>

          <div className="space-y-1">
            <select
              onChange={(e) => {
                const val = e.target.value;
                if (val) {
                  const isAdded = exclusions.some((exc) => exc.content === val);
                  if (!isAdded) {
                    setExclusions([...exclusions, { content: val }]);
                  }
                }
                e.target.value = "";
              }}
              className="w-full bg-[#f3f3f4] border border-black/10 rounded-lg py-2 px-3 text-[11px] font-bold text-[#3a4250] focus:outline-none focus:ring-2 focus:ring-[#9aa3b2]/10 transition-all cursor-pointer"
            >
              <option value="">+ Add standard exclusion...</option>
              {standardExclusions.map((item, idx) => (
                <option
                  key={idx}
                  value={item}
                  disabled={exclusions.some((exc) => exc.content === item)}
                >
                  {exclusions.some((exc) => exc.content === item) ? "✓ " : ""}
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add custom exclusion..."
              value={newExclusion}
              onChange={(e) => setNewExclusion(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && addExclusion()}
              className="flex-1 bg-white border border-black/10 rounded-xl py-2.5 px-4 text-sm font-medium text-[#10182a] focus:outline-none focus:ring-2 focus:ring-[#c7f135]/20 transition-all placeholder:text-[#c9ced6]"
            />
            <button
              onClick={addExclusion}
              className="bg-[#5b6472] text-white p-2 rounded-lg hover:bg-[#3a4250] transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2 max-h-50 overflow-y-auto pr-1 mt-4">
            {exclusions.map((item, index) => (
              <div
                key={index}
                className="group flex items-center justify-between bg-white border border-black/5 p-2.5 rounded-lg transition-all hover:border-black/10 hover:shadow-sm"
              >
                {editingExclusionIndex === index ? (
                  <>
                    <input
                      autoFocus
                      type="text"
                      value={editingExclusionValue}
                      onChange={(e) => setEditingExclusionValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveExclusionEdit(index);
                        if (e.key === "Escape") setEditingExclusionIndex(null);
                      }}
                      className="flex-1 text-[11px] font-medium text-[#3a4250] bg-transparent border-none focus:ring-0 outline-none"
                    />
                    <div className="flex gap-1 ml-2 shrink-0">
                      <button
                        onClick={() => saveExclusionEdit(index)}
                        className="text-white bg-[#c7f135] hover:bg-[#b0dc00] p-1 rounded-md transition-colors"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingExclusionIndex(null)}
                        className="text-[#9aa3b2] hover:text-[#5b6472] hover:bg-[#eef0f1] p-1 rounded-md transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-[11px] font-medium text-[#5b6472] flex-1">
                      {item.content}
                    </span>
                    <div className="flex gap-1 ml-2 shrink-0">
                      <button
                        onClick={() => {
                          setEditingExclusionIndex(index);
                          setEditingExclusionValue(item.content);
                        }}
                        className="text-[#c9ced6] hover:text-[#10182a] transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => removeExclusion(index)}
                        className="text-[#c9ced6] hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {exclusions.length === 0 && (
              <p className="text-[10px] text-center text-[#9aa3b2] italic py-2">
                No exclusions added yet
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TripInfoTab;
