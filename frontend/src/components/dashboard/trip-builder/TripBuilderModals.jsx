import React, { useEffect, useState } from "react";
import { Minus, Plus, AlertTriangle, Ban, X, Trash2, Layers } from "lucide-react";
import Modal from "../../common/Modal";
import DatePicker from "../../common/DatePicker";
import { getHotelBlackouts } from "../../../api/hotels";

const normalizeRoomTypeValue = (value) => String(value || "").trim();

// The Hotel catalog stores star rating as a bare digit ("5"); the trip
// builder's Hotel Category field stores it as "5 Star" — convert when
// pulling a category over from the master hotel record.
const hotelCategoryLabel = (digit) => {
  const n = String(digit || "").trim();
  return n ? `${n} Star` : "";
};

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

const toRoomTypeSlug = (value) =>
  normalizeRoomTypeValue(value).toLowerCase().replace(/\s+/g, "_");

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

const sectionMatchesSeason = (section, dateStr) => {
  if (!section.valid_from && !section.valid_to) return true;
  if (!dateStr) return false;
  const date = new Date(dateStr);
  if (section.valid_from && date < new Date(section.valid_from)) return false;
  if (section.valid_to && date > new Date(section.valid_to)) return false;
  return true;
};

// Matches by room type, then prefers whichever section's season (valid_from/
// valid_to) actually covers the given date — falls back to an always-valid
// (no date range) section, then to any matching-room-type section at all.
const findRoomTypeSection = (hotel, roomTypeValue, dateStr) => {
  if (!hotel || !roomTypeValue) return {};

  const normalized = normalizeRoomTypeValue(roomTypeValue);
  const sections = hotel.price_sections || [];

  const matching = sections.filter(
    (section) =>
      normalizeRoomTypeValue(section.room_type) === normalized ||
      toRoomTypeSlug(section.room_type) === toRoomTypeSlug(normalized),
  );

  return (
    matching.find((section) => dateStr && sectionMatchesSeason(section, dateStr) && (section.valid_from || section.valid_to)) ||
    matching.find((section) => !section.valid_from && !section.valid_to) ||
    matching[0] ||
    {}
  );
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
