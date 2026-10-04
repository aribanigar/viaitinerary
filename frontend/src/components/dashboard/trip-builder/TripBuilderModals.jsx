import React, { useEffect, useState } from "react";
import { Minus, Plus, AlertTriangle, Ban, X, Trash2, Layers } from "lucide-react";
import Modal from "../../common/Modal";
import DatePicker from "../../common/DatePicker";
import { getHotelBlackouts } from "../../../api/hotels";
import { getActivityBlackouts } from "../../../api/activities";
import {
  activityRateOptions,
  findActivityRate,
  dateForDay,
  dayForDate,
} from "../../../utils/activityRates";
import {
  normalizeRoomTypeValue,
  hotelCategoryLabel,
  findRoomTypeSection,
} from "../../../utils/hotelRates";

const expandDateRange = (startStr, endStr) => {
  const dates = [];
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return dates;
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};

const formatRoomTypeLabel = (value) => {
  const normalized = normalizeRoomTypeValue(value);
  if (!normalized) return "";
  const isFlatCase =
    normalized === normalized.toLowerCase() ||
    normalized === normalized.toUpperCase();

  if (!isFlatCase) {
    return normalized;
  }

  return normalized
    .replace(/[_\s]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
};

export const HotelModal = ({
  isOpen,
  onClose,
  isEditing,
  onSubmit,
  hotelForm,
  setHotelForm,
  uniqueCities,
  hotelsInCity,
  masterHotels,
  tripInfo,
  urlTripId,
  reservedAccommodationDates = [],
  token,
  tripMarginPercentage,
}) => {
  const selectedHotel = masterHotels.find(
    (hotel) => hotel.id === hotelForm.hotelId,
  );

  const roomTypeOptions = (selectedHotel?.price_sections || [])
    .map((section) => normalizeRoomTypeValue(section.room_type))
    .filter(Boolean)
    .filter((value, index, self) => self.indexOf(value) === index);

  const resolvedRoomType = roomTypeOptions.includes(hotelForm.roomType)
    ? hotelForm.roomType
    : roomTypeOptions[0] || "";

  const [blackouts, setBlackouts] = useState([]);
  useEffect(() => {
    if (!hotelForm.hotelId || !token) {
      setBlackouts([]);
      return;
    }
    let cancelled = false;
    getHotelBlackouts(hotelForm.hotelId, token)
      .then((resp) => {
        if (!cancelled) setBlackouts(resp.data || []);
      })
      .catch(() => setBlackouts([]));
    return () => {
      cancelled = true;
    };
  }, [hotelForm.hotelId, token]);

  const stopSaleDates = blackouts
    .filter((b) => b.type === "stop_sale" && (!b.room_type || b.room_type === hotelForm.roomType))
    .flatMap((b) => expandDateRange(b.start_date, b.end_date));
  const blackoutWarnDates = blackouts
    .filter((b) => b.type === "blackout" && (!b.room_type || b.room_type === hotelForm.roomType))
    .flatMap((b) => expandDateRange(b.start_date, b.end_date));

  const checkInBlocked = hotelForm.checkIn && stopSaleDates.includes(hotelForm.checkIn);
  const checkOutBlocked = hotelForm.checkOut && stopSaleDates.includes(hotelForm.checkOut);
  const checkInWarn = hotelForm.checkIn && blackoutWarnDates.includes(hotelForm.checkIn);
  const checkOutWarn = hotelForm.checkOut && blackoutWarnDates.includes(hotelForm.checkOut);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Accommodation"
      isEditing={isEditing}
      onSubmit={onSubmit}
    >
      <div className="space-y-6 flex flex-col">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#181c22]/45 uppercase tracking-[0.12em] mb-1.5">
              City
            </label>
            <select
              className="w-full bg-[#f3f3f4] border border-black/5 rounded-xl py-2.5 px-4 text-sm font-bold text-[#181c22] focus:outline-none focus:ring-2 focus:ring-[#e7f63c]/20 transition-all appearance-none cursor-pointer"
              value={hotelForm.city}
              onChange={(e) =>
                setHotelForm({ ...hotelForm, city: e.target.value, name: "" })
              }
            >
              <option value="">Select City</option>
              {uniqueCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#181c22]/45 uppercase tracking-[0.12em] mb-1.5">
              Hotel Name
            </label>
            <select
              className="w-full bg-[#f3f3f4] border border-black/5 rounded-xl py-2.5 px-4 text-sm font-bold text-[#181c22] focus:outline-none focus:ring-2 focus:ring-[#e7f63c]/20 transition-all appearance-none cursor-pointer"
              value={hotelForm.hotelId || ""}
              onChange={(e) => {
                const selectedHotel = masterHotels.find(
                  (h) => String(h.id) === e.target.value,
                );
                if (selectedHotel) {
                  const availableRoomTypes = (
                    selectedHotel.price_sections || []
                  )
                    .map((section) => normalizeRoomTypeValue(section.room_type))
                    .filter(Boolean)
                    .filter(
                      (value, index, self) => self.indexOf(value) === index,
                    );

                  const initialRoomType = availableRoomTypes.includes(
                    hotelForm.roomType,
                  )
                    ? hotelForm.roomType
                    : availableRoomTypes[0] || "";

                  const section = findRoomTypeSection(
                    selectedHotel,
                    initialRoomType,
                    hotelForm.checkIn,
                  );

                  const initialPrice = section.price || 0;

                  const allBedPrices = [
                    { category: "cnb", price: section.cnb || 0 },
                    { category: "5_to_12", price: section.upto_5 || 0 },
                    { category: "above_12", price: section.above_12 || 0 },
                    { category: "extra_adult", price: section.extra_adult || 0 },
                  ].filter((bp) => bp.price > 0);

                  setHotelForm({
                    ...hotelForm,
                    hotelId: selectedHotel.id,
                    name: selectedHotel.name,
                    category: hotelCategoryLabel(selectedHotel.category) || hotelForm.category,
                    roomType: initialRoomType,
                    pricePerRoom: initialPrice,
                    bedPrices: allBedPrices,
                    photo: selectedHotel.image_url || selectedHotel.image_path,
                  });
                }
              }}
              disabled={!hotelForm.city}
            >
              <option value="">Select Hotel</option>
              {hotelsInCity.map((hotel) => (
                <option key={hotel.id} value={hotel.id}>
                  {hotel.name}
                  {hotel.is_available === false ? " (Unavailable)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#181c22]/45 uppercase tracking-[0.12em] mb-1.5 leading-none">
              Hotel Category
            </label>
            <select
              className="w-full bg-[#f3f3f4] border border-black/5 rounded-xl py-2.5 px-4 text-sm font-bold text-[#181c22] focus:outline-none focus:ring-2 focus:ring-[#e7f63c]/20 transition-all appearance-none cursor-pointer"
              value={hotelForm.category}
              onChange={(e) =>
                setHotelForm({ ...hotelForm, category: e.target.value })
              }
            >
              <option value="1 Star">1 Star</option>
              <option value="2 Star">2 Star</option>
              <option value="3 Star">3 Star</option>
              <option value="4 Star">4 Star</option>
              <option value="5 Star">5 Star</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#181c22]/45 uppercase tracking-[0.12em] mb-1.5 leading-none">
              Room Type
            </label>
            <select
              className="w-full bg-[#f3f3f4] border border-black/5 rounded-xl py-2.5 px-4 text-sm font-bold text-[#181c22] focus:outline-none focus:ring-2 focus:ring-[#e7f63c]/20 transition-all appearance-none cursor-pointer"
              value={resolvedRoomType}
              onChange={(e) => {
                const newRoomType = e.target.value;
                let updatedPrice = hotelForm.pricePerRoom;
                let updatedBedPrices = hotelForm.bedPrices;

                if (hotelForm.hotelId) {
                  const selectedHotel = masterHotels.find(
                    (h) => h.id === hotelForm.hotelId,
                  );
                  if (selectedHotel) {
                    const section = findRoomTypeSection(
                      selectedHotel,
                      newRoomType,
                      hotelForm.checkIn,
                    );

                    updatedPrice = section.price || 0;

                    updatedBedPrices = [
                      { category: "cnb", price: section.cnb || 0 },
                      { category: "5_to_12", price: section.upto_5 || 0 },
                      { category: "above_12", price: section.above_12 || 0 },
                      { category: "extra_adult", price: section.extra_adult || 0 },
                    ].filter((bp) => bp.price > 0);
                  }
                }

                setHotelForm({
                  ...hotelForm,
                  roomType: newRoomType,
                  pricePerRoom: updatedPrice,
                  bedPrices: updatedBedPrices,
                });
              }}
            >
              <option value="" disabled>
                {hotelForm.hotelId ? "Select Room Type" : "Select Hotel First"}
              </option>
              {roomTypeOptions.map((roomType) => (
                <option key={roomType} value={roomType}>
                  {formatRoomTypeLabel(roomType)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#181c22]/45 uppercase tracking-[0.12em] mb-1.5 leading-none">
              Rooms
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const current = parseInt(hotelForm.rooms || 1);
                  setHotelForm({
                    ...hotelForm,
                    rooms: Math.max(1, current - 1).toString(),
                  });
                }}
                className="w-8 h-8 rounded-lg bg-[#eef0f1] flex items-center justify-center hover:bg-[#e6e8eb] transition-colors"
              >
                <Minus className="w-3 h-3 text-[#5b6472]" />
              </button>
              <span className="font-semibold text-[#181c22] w-4 text-center text-sm">
                {hotelForm.rooms || 1}
              </span>
              <button
                type="button"
                onClick={() => {
                  const current = parseInt(hotelForm.rooms || 1);
                  setHotelForm({
                    ...hotelForm,
                    rooms: (current + 1).toString(),
                  });
                }}
                className="w-8 h-8 rounded-lg bg-[#eef0f1] flex items-center justify-center hover:bg-[#e6e8eb] transition-colors"
              >
                <Plus className="w-3 h-3 text-[#5b6472]" />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#181c22]/45 uppercase tracking-[0.12em] mb-1.5 leading-none">
              CNB
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const current = parseInt(hotelForm.cnbCount || 0);
                  setHotelForm({
                    ...hotelForm,
                    cnbCount: Math.max(0, current - 1).toString(),
                  });
                }}
                className="w-8 h-8 rounded-lg bg-[#eef0f1] flex items-center justify-center hover:bg-[#e6e8eb] transition-colors"
              >
                <Minus className="w-3 h-3 text-[#5b6472]" />
              </button>
              <span className="font-semibold text-[#181c22] w-4 text-center text-sm">
                {hotelForm.cnbCount || 0}
              </span>
              <button
                type="button"
                onClick={() => {
                  const current = parseInt(hotelForm.cnbCount || 0);
                  setHotelForm({
                    ...hotelForm,
                    cnbCount: (current + 1).toString(),
                  });
                }}
                className="w-8 h-8 rounded-lg bg-[#eef0f1] flex items-center justify-center hover:bg-[#e6e8eb] transition-colors"
              >
                <Plus className="w-3 h-3 text-[#5b6472]" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#181c22]/45 uppercase tracking-[0.12em] mb-1.5 leading-none">
              Extra Beds (5 to 12)
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const current = parseInt(hotelForm.extraBeds5To12Count || 0);
                  setHotelForm({
                    ...hotelForm,
                    extraBeds5To12Count: Math.max(0, current - 1).toString(),
                  });
                }}
                className="w-8 h-8 rounded-lg bg-[#eef0f1] flex items-center justify-center hover:bg-[#e6e8eb] transition-colors"
              >
                <Minus className="w-3 h-3 text-[#5b6472]" />
              </button>
              <span className="font-semibold text-[#181c22] w-4 text-center text-sm">
                {hotelForm.extraBeds5To12Count || 0}
              </span>
              <button
                type="button"
                onClick={() => {
                  const current = parseInt(hotelForm.extraBeds5To12Count || 0);
                  setHotelForm({
                    ...hotelForm,
                    extraBeds5To12Count: (current + 1).toString(),
                  });
                }}
                className="w-8 h-8 rounded-lg bg-[#eef0f1] flex items-center justify-center hover:bg-[#e6e8eb] transition-colors"
              >
                <Plus className="w-3 h-3 text-[#5b6472]" />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#181c22]/45 uppercase tracking-[0.12em] mb-1.5 leading-none">
              Extra Beds (Above 12 Years)
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const current = parseInt(
                    hotelForm.extraBedsAbove12Count || 0,
                  );
                  setHotelForm({
                    ...hotelForm,
                    extraBedsAbove12Count: Math.max(0, current - 1).toString(),
                  });
                }}
                className="w-8 h-8 rounded-lg bg-[#eef0f1] flex items-center justify-center hover:bg-[#e6e8eb] transition-colors"
              >
                <Minus className="w-3 h-3 text-[#5b6472]" />
              </button>
              <span className="font-semibold text-[#181c22] w-4 text-center text-sm">
                {hotelForm.extraBedsAbove12Count || 0}
              </span>
              <button
                type="button"
                onClick={() => {
                  const current = parseInt(
                    hotelForm.extraBedsAbove12Count || 0,
                  );
                  setHotelForm({
                    ...hotelForm,
                    extraBedsAbove12Count: (current + 1).toString(),
                  });
                }}
                className="w-8 h-8 rounded-lg bg-[#eef0f1] flex items-center justify-center hover:bg-[#e6e8eb] transition-colors"
              >
                <Plus className="w-3 h-3 text-[#5b6472]" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#181c22]/45 uppercase tracking-[0.12em] mb-1.5 leading-none">
              Extra Adult (AWEB)
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const current = parseInt(hotelForm.extraAdultCount || 0);
                  setHotelForm({
                    ...hotelForm,
                    extraAdultCount: Math.max(0, current - 1).toString(),
                  });
                }}
                className="w-8 h-8 rounded-lg bg-[#eef0f1] flex items-center justify-center hover:bg-[#e6e8eb] transition-colors"
              >
                <Minus className="w-3 h-3 text-[#5b6472]" />
              </button>
              <span className="font-semibold text-[#181c22] w-4 text-center text-sm">
                {hotelForm.extraAdultCount || 0}
              </span>
              <button
                type="button"
                onClick={() => {
                  const current = parseInt(hotelForm.extraAdultCount || 0);
                  setHotelForm({
                    ...hotelForm,
                    extraAdultCount: (current + 1).toString(),
                  });
                }}
                className="w-8 h-8 rounded-lg bg-[#eef0f1] flex items-center justify-center hover:bg-[#e6e8eb] transition-colors"
              >
                <Plus className="w-3 h-3 text-[#5b6472]" />
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-[#181c22]/45 uppercase tracking-[0.12em] mb-1.5 leading-none">
            Meal Plan
          </label>
          <select
            className="w-full bg-[#f3f3f4] border border-black/5 rounded-xl py-2.5 px-3 text-sm font-bold text-[#181c22] focus:outline-none focus:ring-2 focus:ring-[#e7f63c]/20 transition-all appearance-none cursor-pointer"
            value={hotelForm.mealPlan}
            onChange={(e) =>
              setHotelForm({ ...hotelForm, mealPlan: e.target.value })
            }
          >
            <option value="">Select Plan</option>
            <option value="Only Room">Only Room</option>
            <option value="Only Room + Breakfast">Only Room + Breakfast</option>
            <option value="Breakfast + Dinner">Breakfast + Dinner</option>
            <option value="Breakfast + Lunch + Dinner">
              Breakfast + Lunch + Dinner
            </option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-[11px] font-semibold text-[#181c22]/45 uppercase tracking-[0.12em] mb-1.5">
              Check-in
            </label>
            <DatePicker
              value={hotelForm.checkIn}
              onChange={(dateString) => {
                // Re-resolve the room-type price against the new date so
                // season-based rate sheets (valid_from/valid_to) apply.
                if (selectedHotel && resolvedRoomType) {
                  const section = findRoomTypeSection(selectedHotel, resolvedRoomType, dateString);
                  setHotelForm({
                    ...hotelForm,
                    checkIn: dateString,
                    pricePerRoom: section.price || hotelForm.pricePerRoom,
                    bedPrices: [
                      { category: "cnb", price: section.cnb || 0 },
                      { category: "5_to_12", price: section.upto_5 || 0 },
                      { category: "above_12", price: section.above_12 || 0 },
                      { category: "extra_adult", price: section.extra_adult || 0 },
                    ].filter((bp) => bp.price > 0),
                  });
                } else {
                  setHotelForm({ ...hotelForm, checkIn: dateString });
                }
              }}
              className="w-full"
              options={{
                dateFormat: "d-m-Y",
                minDate: urlTripId ? null : tripInfo.startDate || "today",
                highlightRangeStart: hotelForm.checkIn,
                highlightRangeEnd: hotelForm.checkOut,
                reservedDates: reservedAccommodationDates,
                excludeDates: stopSaleDates,
                blackoutDates: blackoutWarnDates,
              }}
            />
            {checkInBlocked && (
              <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold text-red-600">
                <Ban className="w-3 h-3" /> Hotel is stop-sale on this date — pick another.
              </p>
            )}
            {!checkInBlocked && checkInWarn && (
              <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold text-amber-600">
                <AlertTriangle className="w-3 h-3" /> Blackout date — confirm with the hotel before booking.
              </p>
            )}
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#181c22]/45 uppercase tracking-[0.12em] mb-1.5">
              Check-out
            </label>
            <DatePicker
              value={hotelForm.checkOut}
              onChange={(dateString) => {
                setHotelForm({ ...hotelForm, checkOut: dateString });
              }}
              className="w-full"
              options={{
                dateFormat: "d-m-Y",
                minDate: urlTripId
                  ? null
                  : hotelForm.checkIn || tripInfo.startDate || "today",
                highlightRangeStart: hotelForm.checkIn,
                highlightRangeEnd: hotelForm.checkOut,
                reservedDates: reservedAccommodationDates,
                excludeDates: stopSaleDates,
                blackoutDates: blackoutWarnDates,
              }}
            />
            {checkOutBlocked && (
              <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold text-red-600">
                <Ban className="w-3 h-3" /> Hotel is stop-sale on this date — pick another.
              </p>
            )}
            {!checkOutBlocked && checkOutWarn && (
              <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold text-amber-600">
                <AlertTriangle className="w-3 h-3" /> Blackout date — confirm with the hotel before booking.
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-[#181c22]/45 uppercase tracking-[0.12em] mb-1.5 leading-none">
            Markup Override %
          </label>
          <input
            type="number"
            step="0.01"
            className="w-full bg-[#f3f3f4] border border-black/5 rounded-xl py-2.5 px-3 text-sm font-bold text-[#181c22] focus:outline-none focus:ring-2 focus:ring-[#e7f63c]/20 transition-all"
            placeholder={`Trip default: ${tripMarginPercentage || 0}%`}
            value={hotelForm.markupPercentage}
            onChange={(e) =>
              setHotelForm({ ...hotelForm, markupPercentage: e.target.value })
            }
          />
          <p className="mt-1.5 text-[10px] text-[#181c22]/40 font-medium">
            Leave blank to use the trip's overall margin for this hotel.
          </p>
        </div>

        <div className="pt-2 border-t border-black/5">
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#181c22]/70 uppercase tracking-[0.12em]">
              <Layers className="w-3.5 h-3.5" /> Similar Options
            </label>
            <button
              type="button"
              onClick={() =>
                setHotelForm({
                  ...hotelForm,
                  alternateOptions: [
                    ...(hotelForm.alternateOptions || []),
                    { name: "", room_type: "", price: "" },
                  ],
                })
              }
              className="flex items-center gap-1 text-[11px] font-bold text-blue-600"
            >
              <Plus className="w-3 h-3" /> Add Alternate
            </button>
          </div>
          <p className="text-[10px] text-[#181c22]/40 font-medium mb-2">
            Offer the client a choice for this night — the price shown will be the
            highest of all options, so margin is protected either way.
          </p>
          {(hotelForm.alternateOptions || []).map((opt, idx) => (
            <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-2 items-center">
              <input
                type="text"
                value={opt.name}
                onChange={(e) => {
                  const next = [...hotelForm.alternateOptions];
                  next[idx] = { ...next[idx], name: e.target.value };
                  setHotelForm({ ...hotelForm, alternateOptions: next });
                }}
                placeholder="Hotel name"
                className="sm:col-span-2 bg-[#f3f3f4] border border-black/5 rounded-lg py-2 px-3 text-xs font-bold text-[#181c22]"
              />
              <input
                type="text"
                value={opt.room_type}
                onChange={(e) => {
                  const next = [...hotelForm.alternateOptions];
                  next[idx] = { ...next[idx], room_type: e.target.value };
                  setHotelForm({ ...hotelForm, alternateOptions: next });
                }}
                placeholder="Room type"
                className="bg-[#f3f3f4] border border-black/5 rounded-lg py-2 px-3 text-xs font-bold text-[#181c22]"
              />
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={opt.price}
                  onChange={(e) => {
                    const next = [...hotelForm.alternateOptions];
                    next[idx] = { ...next[idx], price: e.target.value };
                    setHotelForm({ ...hotelForm, alternateOptions: next });
                  }}
                  placeholder="Price"
                  className="w-full bg-[#f3f3f4] border border-black/5 rounded-lg py-2 px-3 text-xs font-bold text-[#181c22]"
                />
                <button
                  type="button"
                  onClick={() => {
                    const next = hotelForm.alternateOptions.filter((_, i) => i !== idx);
                    setHotelForm({ ...hotelForm, alternateOptions: next });
                  }}
                  className="text-slate-300 hover:text-red-500 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {isEditing && (
          <div className="pt-2 border-t border-black/5">
            <label className="flex items-center gap-2 text-[11px] font-semibold text-[#181c22]/70 uppercase tracking-[0.12em] cursor-pointer">
              <input
                type="checkbox"
                checked={!!hotelForm.cancelled}
                onChange={(e) => {
                  const cancelled = e.target.checked;
                  setHotelForm({
                    ...hotelForm,
                    cancelled,
                    cancellationCharge: cancelled ? hotelForm.cancellationCharge : "",
                    cancellationNote: cancelled ? hotelForm.cancellationNote : "",
                  });
                }}
                className="w-4 h-4 rounded accent-red-500"
              />
              Mark this booking as cancelled
            </label>
            {hotelForm.cancelled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#181c22]/45 uppercase tracking-[0.12em] mb-1.5">
                    Cancellation Charge
                  </label>
                  <input
                    type="number"
                    value={hotelForm.cancellationCharge}
                    onChange={(e) =>
                      setHotelForm({ ...hotelForm, cancellationCharge: e.target.value })
                    }
                    placeholder="0.00"
                    className="w-full bg-[#f3f3f4] border border-black/5 rounded-xl py-2.5 px-4 text-sm font-bold text-[#181c22] focus:outline-none focus:ring-2 focus:ring-[#e7f63c]/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#181c22]/45 uppercase tracking-[0.12em] mb-1.5">
                    Note
                  </label>
                  <input
                    type="text"
                    value={hotelForm.cancellationNote}
                    onChange={(e) =>
                      setHotelForm({ ...hotelForm, cancellationNote: e.target.value })
                    }
                    placeholder="Reason / reference"
                    className="w-full bg-[#f3f3f4] border border-black/5 rounded-xl py-2.5 px-4 text-sm font-bold text-[#181c22] focus:outline-none focus:ring-2 focus:ring-[#e7f63c]/20 transition-all"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

export const TransportModal = ({
  isOpen,
  onClose,
  isEditing,
  onSubmit,
  transportForm,
  setTransportForm,
  availableVehicles,
  tripInfo,
  urlTripId,
  tripMarginPercentage,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Transport"
      isEditing={isEditing}
      onSubmit={onSubmit}
    >
      <div className="space-y-6 flex flex-col">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#181c22]/45 uppercase tracking-[0.12em] mb-1.5">
              Trip Type
            </label>
            <select
              className="w-full bg-[#f3f3f4] border border-black/5 rounded-xl py-2.5 px-4 text-sm font-bold text-[#181c22] focus:outline-none focus:ring-2 focus:ring-[#e7f63c]/20 transition-all appearance-none cursor-pointer"
              value={transportForm.tripType}
              onChange={(e) =>
                setTransportForm({
                  ...transportForm,
                  tripType: e.target.value,
                })
              }
            >
              <option value="Transfer">Transfer</option>
              <option value="Sightseeing">Sightseeing</option>
              <option value="Day Trip">Day Trip</option>
              <option value="Stay">Stay</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#181c22]/45 uppercase tracking-[0.12em] mb-1.5">
              Route (e.g. Airport - Hotel)
            </label>
            <input
              type="text"
              placeholder="e.g. Airport -> Hotel"
              className="w-full bg-[#f3f3f4] border border-black/5 rounded-xl py-2.5 px-4 text-sm font-bold text-[#181c22] focus:outline-none focus:ring-2 focus:ring-[#e7f63c]/20 transition-all placeholder:text-[#c9ced6]"
              value={transportForm.route}
              onChange={(e) =>
                setTransportForm({
                  ...transportForm,
                  route: e.target.value,
                })
              }
            />
          </div>
        </div>

        <div className="hidden">
          <label className="block text-[11px] font-semibold text-[#181c22]/45 uppercase tracking-[0.12em] mb-1.5">
            Destination
          </label>
          <input
            type="text"
            placeholder="e.g. Manali"
            className="w-full bg-[#f3f3f4] border border-black/5 rounded-xl py-2.5 px-4 text-sm font-bold text-[#181c22] focus:outline-none focus:ring-2 focus:ring-[#e7f63c]/20 transition-all placeholder:text-[#c9ced6]"
            value={transportForm.destination || ""}
            onChange={(e) =>
              setTransportForm({
                ...transportForm,
                destination: e.target.value,
              })
            }
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#181c22]/45 uppercase tracking-[0.12em] mb-1.5">
              Date
            </label>
            <DatePicker
              value={transportForm.date}
              onChange={(dateString) => {
                setTransportForm({
                  ...transportForm,
                  date: dateString,
                });
              }}
              className="w-full"
              options={{
                dateFormat: "d-m-Y",
                minDate: urlTripId ? null : tripInfo.startDate || "today",
              }}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#181c22]/45 uppercase tracking-[0.12em] mb-1.5">
              Vehicle
            </label>
            <select
              className="w-full bg-[#f3f3f4] border border-black/5 rounded-xl py-3 px-4 text-xs font-bold text-[#181c22] focus:outline-none focus:ring-2 focus:ring-[#e7f63c]/20 transition-all appearance-none cursor-pointer"
              value={transportForm.vehicleId || ""}
              onChange={(e) => {
                const selectedVehicle = availableVehicles.find(
                  (v) => String(v.id) === e.target.value,
                );
                if (selectedVehicle) {
                  setTransportForm({
                    ...transportForm,
                    vehicleId: selectedVehicle.id,
                    vehicleType: selectedVehicle.name,
                  });
                }
              }}
            >
              <option value="">Select a Vehicle</option>
              {availableVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#181c22]/45 uppercase tracking-[0.12em] mb-1.5">
              Number of Vehicles
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const current = parseInt(transportForm.quantity || 1);
                  setTransportForm({
                    ...transportForm,
                    quantity: Math.max(1, current - 1),
                  });
                }}
                className="w-8 h-8 rounded-lg bg-[#eef0f1] flex items-center justify-center hover:bg-[#e6e8eb] transition-colors"
              >
                <Minus className="w-3 h-3 text-[#5b6472]" />
              </button>
              <span className="font-semibold text-[#181c22] w-4 text-center text-sm">
                {transportForm.quantity || 1}
              </span>
              <button
                type="button"
                onClick={() => {
                  const current = parseInt(transportForm.quantity || 1);
                  setTransportForm({
                    ...transportForm,
                    quantity: current + 1,
                  });
                }}
                className="w-8 h-8 rounded-lg bg-[#eef0f1] flex items-center justify-center hover:bg-[#e6e8eb] transition-colors"
              >
                <Plus className="w-3 h-3 text-[#5b6472]" />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#181c22]/45 uppercase tracking-[0.12em] mb-1.5">
              Markup Override %
            </label>
            <input
              type="number"
              step="0.01"
              className="w-full bg-[#f3f3f4] border border-black/5 rounded-xl py-2.5 px-4 text-sm font-bold text-[#181c22] focus:outline-none focus:ring-2 focus:ring-[#e7f63c]/20 transition-all placeholder:text-[#c9ced6]"
              placeholder={`Trip default: ${tripMarginPercentage || 0}%`}
              value={transportForm.markupPercentage}
              onChange={(e) =>
                setTransportForm({
                  ...transportForm,
                  markupPercentage: e.target.value,
                })
              }
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-[#181c22]/45 uppercase tracking-[0.12em] mb-1.5">
            Any remarks?
          </label>
          <textarea
            placeholder="e.g. Private Transfer, Meet & Greet"
            className="w-full bg-[#f3f3f4] border border-black/5 rounded-xl py-2.5 px-4 text-sm font-bold text-[#181c22] focus:outline-none focus:ring-2 focus:ring-[#e7f63c]/20 transition-all placeholder:text-[#c9ced6] min-h-20 resize-none"
            value={transportForm.remarks}
            onChange={(e) =>
              setTransportForm({
                ...transportForm,
                remarks: e.target.value,
              })
            }
          />
        </div>
      </div>
    </Modal>
  );
};

// Activities are filtered to ones tagged to the trip's own destination, plus
// any not tied to a specific destination (agency-wide, e.g. a generic
// photography add-on) — mirrors how Vehicles aren't destination-pinned.
// The city an activity belongs to: its own city, else its destination's name.
const activityCityOf = (activity, destinations) =>
  (activity?.city ||
    destinations.find((d) => d.id === activity?.destination_id)?.name ||
    "").trim();

const fieldLabel =
  "block text-[11px] font-semibold text-[#181c22]/45 uppercase tracking-[0.12em] mb-1.5 leading-none";
const selectCls =
  "w-full bg-[#f3f3f4] border border-black/5 rounded-xl py-2.5 px-4 text-sm font-bold text-[#181c22] focus:outline-none focus:ring-2 focus:ring-[#e7f63c]/20 transition-all appearance-none cursor-pointer";
const inputCls =
  "w-full bg-[#f3f3f4] border border-black/5 rounded-xl py-2.5 px-4 text-sm font-bold text-[#181c22] focus:outline-none focus:ring-2 focus:ring-[#e7f63c]/20 transition-all placeholder:text-[#c9ced6]";

const Counter = ({ value, min, onChange }) => (
  <div className="flex items-center gap-3">
    <button
      type="button"
      onClick={() => onChange(Math.max(min, (parseInt(value, 10) || 0) - 1))}
      className="w-8 h-8 rounded-lg bg-[#eef0f1] flex items-center justify-center hover:bg-[#e6e8eb] transition-colors"
    >
      <Minus className="w-3 h-3 text-[#5b6472]" />
    </button>
    <span className="font-semibold text-[#181c22] w-4 text-center text-sm">
      {parseInt(value, 10) || min}
    </span>
    <button
      type="button"
      onClick={() => onChange((parseInt(value, 10) || 0) + 1)}
      className="w-8 h-8 rounded-lg bg-[#eef0f1] flex items-center justify-center hover:bg-[#e6e8eb] transition-colors"
    >
      <Plus className="w-3 h-3 text-[#5b6472]" />
    </button>
  </div>
);

export const ActivityModal = ({
  isOpen,
  onClose,
  isEditing,
  onSubmit,
  activityForm,
  setActivityForm,
  availableActivities,
  availableDestinations = [],
  tripInfo,
  token,
  urlTripId,
  tripMarginPercentage,
}) => {
  const cities = availableActivities
    .map((a) => activityCityOf(a, availableDestinations))
    .filter((c, i, all) => c && all.indexOf(c) === i)
    .sort((a, b) => a.localeCompare(b));

  const activitiesInCity = availableActivities.filter(
    (a) => !activityForm.city || activityCityOf(a, availableDestinations) === activityForm.city,
  );
  const selected = availableActivities.find((a) => a.id === activityForm.activityId);
  const rateOptions = activityRateOptions(selected);
  const date = activityForm.date || dateForDay(tripInfo.startDate, activityForm.dayNumber);

  // Re-price from the catalog's rate sheet (option + the date's season).
  const withRate = (form, activity, { option, date: when } = {}) => {
    if (!activity) return form;
    const rate = findActivityRate(activity, {
      option: option ?? form.rateOption ?? "",
      date: when ?? form.date ?? "",
    });
    return {
      ...form,
      rateOption: rate.option,
      pricePerTicket: rate.price || "",
      // No child rate on the sheet → children pay the adult rate.
      childPrice: rate.childPrice || rate.price || "",
      costPerTicket: rate.cost || "",
      childCost: rate.childCost || rate.cost || "",
    };
  };

  // Fetched blackouts, keyed by the activity they belong to.
  const [fetchedBlackouts, setFetchedBlackouts] = useState({ id: null, rows: [] });
  useEffect(() => {
    const id = activityForm.activityId;
    if (!id || !token) return undefined;
    let cancelled = false;
    getActivityBlackouts(id, token)
      .then((resp) => {
        if (!cancelled) setFetchedBlackouts({ id, rows: resp.data || [] });
      })
      .catch(() => {
        if (!cancelled) setFetchedBlackouts({ id, rows: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [activityForm.activityId, token]);
  const blackouts =
    fetchedBlackouts.id === activityForm.activityId ? fetchedBlackouts.rows : [];

  const stopSaleDates = blackouts
    .filter((b) => b.type === "stop_sale")
    .flatMap((b) => expandDateRange(b.start_date, b.end_date));
  const blackoutWarnDates = blackouts
    .filter((b) => b.type === "blackout")
    .flatMap((b) => expandDateRange(b.start_date, b.end_date));
  const dateBlocked = date && stopSaleDates.includes(date);
  const dateWarn = date && blackoutWarnDates.includes(date);

  const adults = parseInt(activityForm.ticketCount, 10) || 1;
  const children = parseInt(activityForm.childCount, 10) || 0;
  const adultPrice = Number(activityForm.pricePerTicket || 0);
  const childPrice = Number(activityForm.childPrice || 0);
  const total = adults * adultPrice + children * childPrice;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Activity"
      isEditing={isEditing}
      onSubmit={onSubmit}
    >
      <div className="space-y-6 flex flex-col">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={fieldLabel}>City</label>
            <select
              className={selectCls}
              value={activityForm.city || ""}
              onChange={(e) =>
                setActivityForm({ ...activityForm, city: e.target.value })
              }
            >
              <option value="">All Cities</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={fieldLabel}>Activity</label>
            <select
              className={selectCls}
              value={activityForm.activityId || ""}
              onChange={(e) => {
                const activity = availableActivities.find(
                  (a) => String(a.id) === e.target.value,
                );
                if (!activity) return;
                const city = activityCityOf(activity, availableDestinations);
                setActivityForm(
                  withRate(
                    {
                      ...activityForm,
                      activityId: activity.id,
                      name: activity.name,
                      city: activityForm.city || city,
                      location: city || activityForm.location,
                      photo: activity.image_url || null,
                    },
                    activity,
                    { option: activityRateOptions(activity)[0] || "", date },
                  ),
                );
              }}
            >
              <option value="">Select Activity</option>
              {activitiesInCity.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={fieldLabel}>Date</label>
            <DatePicker
              value={date}
              onChange={(dateString) => {
                const next = {
                  ...activityForm,
                  date: dateString,
                  dayNumber: dayForDate(tripInfo.startDate, dateString),
                };
                setActivityForm(
                  selected ? withRate(next, selected, { date: dateString }) : next,
                );
              }}
              className="w-full"
              options={{
                dateFormat: "d-m-Y",
                minDate: urlTripId ? null : tripInfo.startDate || "today",
                excludeDates: stopSaleDates,
              }}
            />
            {activityForm.dayNumber && (
              <p className="mt-1.5 text-[11px] font-bold text-[#5b6472]">
                Day {activityForm.dayNumber} of the trip
              </p>
            )}
            {dateBlocked && (
              <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold text-red-600">
                <Ban className="w-3 h-3" /> Activity is stop-sale on this date — pick another.
              </p>
            )}
            {!dateBlocked && dateWarn && (
              <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold text-amber-600">
                <AlertTriangle className="w-3 h-3" /> Blackout date — confirm with the supplier before booking.
              </p>
            )}
          </div>
          <div>
            <label className={fieldLabel}>Rate Option</label>
            <select
              className={selectCls}
              value={activityForm.rateOption || ""}
              disabled={!selected}
              onChange={(e) =>
                setActivityForm(
                  withRate(activityForm, selected, { option: e.target.value, date }),
                )
              }
            >
              <option value="">
                {selected ? "Standard rate" : "Select Activity First"}
              </option>
              {rateOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={fieldLabel}>Adults</label>
            <Counter
              value={activityForm.ticketCount}
              min={1}
              onChange={(v) => setActivityForm({ ...activityForm, ticketCount: String(v) })}
            />
          </div>
          <div>
            <label className={fieldLabel}>Children</label>
            <Counter
              value={activityForm.childCount}
              min={0}
              onChange={(v) => setActivityForm({ ...activityForm, childCount: String(v) })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={fieldLabel}>Price per Adult (₹)</label>
            <input
              type="number"
              step="0.01"
              className={inputCls}
              value={activityForm.pricePerTicket}
              onChange={(e) =>
                setActivityForm({ ...activityForm, pricePerTicket: e.target.value })
              }
            />
          </div>
          <div>
            <label className={fieldLabel}>Price per Child (₹)</label>
            <input
              type="number"
              step="0.01"
              className={inputCls}
              value={activityForm.childPrice ?? ""}
              onChange={(e) =>
                setActivityForm({ ...activityForm, childPrice: e.target.value })
              }
            />
          </div>
        </div>

        <p className="text-xs font-semibold text-[#5b6472] bg-[#f3f3f4] rounded-xl px-4 py-2.5">
          {adults} × ₹{adultPrice.toLocaleString("en-IN")}
          {children > 0 && ` + ${children} × ₹${childPrice.toLocaleString("en-IN")}`} ={" "}
          <span className="text-[#181c22] font-bold">
            ₹{total.toLocaleString("en-IN")}
          </span>{" "}
          added to the trip cost
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={fieldLabel}>Activity Name</label>
            <input
              type="text"
              placeholder="e.g. Gondola Ride"
              className={inputCls}
              value={activityForm.name}
              onChange={(e) =>
                setActivityForm({ ...activityForm, name: e.target.value })
              }
            />
          </div>
          <div>
            <label className={fieldLabel}>Location</label>
            <input
              type="text"
              placeholder="e.g. Gulmarg"
              className={inputCls}
              value={activityForm.location}
              onChange={(e) =>
                setActivityForm({ ...activityForm, location: e.target.value })
              }
            />
          </div>
        </div>

        <div>
          <label className={fieldLabel}>Markup Override %</label>
          <input
            type="number"
            step="0.01"
            className={inputCls}
            placeholder={`Trip default: ${tripMarginPercentage || 0}%`}
            value={activityForm.markupPercentage}
            onChange={(e) =>
              setActivityForm({ ...activityForm, markupPercentage: e.target.value })
            }
          />
        </div>

        <div>
          <label className={fieldLabel}>Notes</label>
          <textarea
            placeholder="e.g. Weather-dependent, min age 8"
            className={`${inputCls} min-h-20 resize-none`}
            value={activityForm.notes}
            onChange={(e) =>
              setActivityForm({ ...activityForm, notes: e.target.value })
            }
          />
        </div>
      </div>
    </Modal>
  );
};
