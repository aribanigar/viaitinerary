import React from "react";
import { Briefcase, Hotel, MapPin, Pencil, Plus, Trash2 } from "lucide-react";

const parseAccommodationDate = (dateValue) => {
  if (!dateValue) return null;
  if (dateValue instanceof Date) {
    return Number.isNaN(dateValue.getTime()) ? null : dateValue;
  }

  const raw = String(dateValue).trim();

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const dmyMatch = raw.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})(?:\s+.*)?$/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const LogisticsTab = ({
  groupedAccommodations,
  tripInfo,
  formatAgeGroupLabel,
  openEditHotelModal,
  removeAccommodation,
  setHotelForm,
  setEditingHotelId,
  setIsHotelModalOpen,
  sortedTransportation,
  openEditTransportModal,
  removeTransportation,
  setTransportForm,
  setEditingTransportId,
  setIsTransportModalOpen,
  formatImageUrl,
}) => {
  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
      <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center border border-blue-100">
            <MapPin className="w-5 h-5" />
          </div>
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">
            Accommodation
          </h3>
        </div>

        <div className="space-y-4">
          {groupedAccommodations.map((hotel) => (
            <div
              key={hotel.id}
              className="bg-[#f9f9f9]/50 border border-slate-100 rounded-xl p-6 transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 group"
            >
              <div className="flex justify-between items-start mb-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {(hotel.allDates || [])
                      .sort((a, b) => {
                        const aDate = parseAccommodationDate(a.checkIn);
                        const bDate = parseAccommodationDate(b.checkIn);
                        if (!aDate) return 1;
                        if (!bDate) return -1;
                        return aDate - bDate;
                      })
                      .map((stay, stayIdx) => {
                        const stayDays = [];
                        const parsedCheckIn = parseAccommodationDate(
                          stay.checkIn,
                        );
                        const parsedTripStart = parseAccommodationDate(
                          tripInfo.startDate,
                        );
                        const startDayNum =
                          parsedCheckIn && parsedTripStart
                            ? Math.floor(
                                (parsedCheckIn - parsedTripStart) /
                                  (1000 * 60 * 60 * 24),
                              ) + 1
                            : 1;

                        let nights = 1;
                        const parsedCheckOut = parseAccommodationDate(
                          stay.checkOut,
                        );
                        if (parsedCheckIn && parsedCheckOut) {
                          const diffTime = Math.abs(
                            parsedCheckOut - parsedCheckIn,
                          );
                          const diffDays = Math.ceil(
                            diffTime / (1000 * 60 * 60 * 24),
                          );
                          nights = diffDays > 0 ? diffDays : 1;
                        }

                        for (let i = 0; i < nights; i++) {
                          stayDays.push(startDayNum + i);
                        }

                        const suffix = (n) => {
                          const s = ["th", "st", "nd", "rd"];
                          const v = n % 100;
                          return s[(v - 20) % 10] || s[v] || s[0];
                        };

                        const dayLabels = stayDays.map(
                          (d) => `${d}${suffix(d)}`,
                        );
                        let label = "";
                        if (dayLabels.length > 2) {
                          const last = dayLabels.pop();
                          label = `${dayLabels.join(", ")} & ${last} Day`;
                        } else if (dayLabels.length === 2) {
                          label = `${dayLabels[0]} & ${dayLabels[1]} Day`;
                        } else {
                          label = `${dayLabels[0]} Day`;
                        }

                        return (
                          <span
                            key={stayIdx}
                            className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-tighter"
                          >
                            {label}
                          </span>
                        );
                      })}
                  </div>
                  <h4 className="text-lg font-black text-slate-900 border-none outline-none focus:ring-0 bg-transparent">
                    {hotel.name}
                  </h4>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {hotel.city}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                    <div className="bg-white border border-slate-100 px-3 py-1 rounded-md text-blue-500 text-[10px] font-black uppercase tracking-wider shadow-sm">
                      {hotel.category}
                    </div>
                    {hotel.roomType && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                        <div className="bg-blue-50 border border-blue-100 px-3 py-1 rounded-md text-blue-600 text-[10px] font-black uppercase tracking-wider shadow-sm">
                          {hotel.roomType}
                        </div>
                      </>
                    )}
                    <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        Rooms:
                      </span>
                      <span className="text-xs font-bold text-slate-600">
                        {hotel.rooms || "-"}
                      </span>
                    </div>
                    {parseInt(hotel.extraBeds5To12Count || 0, 10) > 0 && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            Extra Beds:
                          </span>
                          <span className="text-xs font-bold text-slate-600">
                            {hotel.extraBeds5To12Count} (
                            {formatAgeGroupLabel("5_to_12")})
                          </span>
                        </div>
                      </>
                    )}
                    {parseInt(hotel.extraBedsAbove12Count || 0, 10) > 0 && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            Extra Beds:
                          </span>
                          <span className="text-xs font-bold text-slate-600">
                            {hotel.extraBedsAbove12Count} (
                            {formatAgeGroupLabel("above_12")})
                          </span>
                        </div>
                      </>
                    )}
                    {hotel.cnbCount && parseInt(hotel.cnbCount, 10) > 0 && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            CNB:
                          </span>
                          <span className="text-xs font-bold text-slate-600">
                            {hotel.cnbCount}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditHotelModal(hotel)}
                    className="p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-all"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() =>
                      (hotel.allIds || [hotel.id]).forEach((id) =>
                        removeAccommodation(id),
                      )
                    }
                    className="p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="relative">
                <div className="w-full h-32 bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center border-2 border-slate-100 transition-all relative group">
                  {hotel.photo ? (
                    <img
                      src={formatImageUrl(hotel.photo)}
                      alt={hotel.name}
                      className="w-full h-full object-cover transition-all"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Hotel className="w-6 h-6 text-slate-300" />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        No Photo Available
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={() => {
              setHotelForm({
                hotelId: null,
                name: "",
                city: "",
                category: "4 Star",
                roomType: "Deluxe",
                checkIn: tripInfo.startDate || "",
                checkOut: tripInfo.startDate || "",
                rooms: "1",
                cnbCount: "0",
                extraBeds5To12Count: "0",
                extraBedsAbove12Count: "0",
                mealPlan: "",
                pricePerRoom: "",
                bedPrices: [],
                photo: null,
              });
              setEditingHotelId(null);
              setIsHotelModalOpen(true);
            }}
            className="w-full border-2 border-dashed border-slate-200 rounded-xl py-5 flex items-center justify-center gap-2 text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/10 transition-all font-bold text-xs"
          >
            <Plus className="w-4 h-4" />
            Add Hotel
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center border border-blue-100">
            <Briefcase className="w-5 h-5" />
          </div>
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">
            Transportation
          </h3>
        </div>

        <div className="space-y-4">
          {sortedTransportation.map((item, index) => {
            const uniqueDates = [
              ...new Set(
                sortedTransportation.map((t) => t.date).filter(Boolean),
              ),
            ].sort((a, b) => new Date(a) - new Date(b));

            const dayNumber = item.date
              ? uniqueDates.indexOf(item.date) + 1
              : index + 1;

            const dateSuffix = (n) => {
              const s = ["th", "st", "nd", "rd"];
              const v = n % 100;
              return (s[(v - 20) % 10] || s[v] || s[0]) + " Day";
            };

            return (
              <div
                key={item.id}
                className="group relative bg-[#f9f9f9]/50 border border-slate-100 rounded-xl p-5 transition-all hover:bg-white hover:shadow-lg hover:shadow-slate-200/40"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                        {dayNumber}
                        {dateSuffix(dayNumber)}
                      </span>
                      <span className="text-[9px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase tracking-tighter">
                        {item.tripType || "Transfer"}
                      </span>
                      <h4 className="text-sm font-black text-slate-900">
                        {item.route}
                      </h4>
                      {item.destination && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                          <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                            {item.destination}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-500">
                        {item.quantity > 1 ? `${item.quantity} x ` : ""}
                        {item.vehicleType}
                      </span>
                      {item.remarks && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                          <span className="text-[11px] font-medium text-slate-400">
                            {item.remarks}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="bg-white border border-slate-100 px-3 py-1.5 rounded-lg text-slate-600 text-[10px] font-bold shadow-sm">
                      {new Date(item.date).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditTransportModal(item)}
                        className="p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-all"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeTransportation(item.id)}
                        className="p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <button
            onClick={() => {
              setTransportForm({
                route: "",
                date: tripInfo.startDate || "",
                vehicleType: "",
                remarks: "",
              });
              setEditingTransportId(null);
              setIsTransportModalOpen(true);
            }}
            className="w-full border-2 border-dashed border-slate-200 rounded-xl py-5 flex items-center justify-center gap-2 text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/10 transition-all font-bold text-xs"
          >
            <Plus className="w-4 h-4" />
            Add Transport
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogisticsTab;
