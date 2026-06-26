import React from "react";
import { Minus, Plus } from "lucide-react";
import Modal from "../../common/Modal";
import DatePicker from "../../common/DatePicker";

const normalizeRoomTypeValue = (value) => String(value || "").trim();

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

const findRoomTypeSection = (hotel, roomTypeValue) => {
  if (!hotel || !roomTypeValue) return {};

  const normalized = normalizeRoomTypeValue(roomTypeValue);
  const sections = hotel.price_sections || [];

  return (
    sections.find(
      (section) => normalizeRoomTypeValue(section.room_type) === normalized,
    ) ||
    sections.find(
      (section) =>
        toRoomTypeSlug(section.room_type) === toRoomTypeSlug(normalized),
    ) ||
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Accommodation"
      isEditing={isEditing}
      onSubmit={onSubmit}
    >
      <div className="space-y-6 flex flex-col">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
              City
            </label>
            <select
              className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2.5 px-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer"
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
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
              Hotel Name
            </label>
            <select
              className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2.5 px-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer"
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
                  );

                  const initialPrice = section.price || 0;

                  const allBedPrices = [
                    { category: "cnb", price: section.cnb || 0 },
                    { category: "5_to_12", price: section.upto_5 || 0 },
                    { category: "above_12", price: section.above_12 || 0 },
                  ].filter((bp) => bp.price > 0);

                  setHotelForm({
                    ...hotelForm,
                    hotelId: selectedHotel.id,
                    name: selectedHotel.name,
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
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 leading-none">
              Hotel Category
            </label>
            <select
              className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2.5 px-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer"
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
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 leading-none">
              Room Type
            </label>
            <select
              className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2.5 px-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer"
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
                    );

                    updatedPrice = section.price || 0;

                    updatedBedPrices = [
                      { category: "cnb", price: section.cnb || 0 },
                      { category: "5_to_12", price: section.upto_5 || 0 },
                      { category: "above_12", price: section.above_12 || 0 },
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 leading-none">
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
                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <Minus className="w-3 h-3 text-slate-600" />
              </button>
              <span className="font-black text-slate-900 w-4 text-center text-sm">
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
                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <Plus className="w-3 h-3 text-slate-600" />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 leading-none">
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
                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <Minus className="w-3 h-3 text-slate-600" />
              </button>
              <span className="font-black text-slate-900 w-4 text-center text-sm">
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
                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <Plus className="w-3 h-3 text-slate-600" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 leading-none">
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
                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <Minus className="w-3 h-3 text-slate-600" />
              </button>
              <span className="font-black text-slate-900 w-4 text-center text-sm">
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
                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <Plus className="w-3 h-3 text-slate-600" />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 leading-none">
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
                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <Minus className="w-3 h-3 text-slate-600" />
              </button>
              <span className="font-black text-slate-900 w-4 text-center text-sm">
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
                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <Plus className="w-3 h-3 text-slate-600" />
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 leading-none">
            Meal Plan
          </label>
          <select
            className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2.5 px-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer"
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

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
              Check-in
            </label>
            <DatePicker
              value={hotelForm.checkIn}
              onChange={(dateString) => {
                setHotelForm({ ...hotelForm, checkIn: dateString });
              }}
              className="w-full"
              options={{
                dateFormat: "d-m-Y",
                minDate: urlTripId ? null : tripInfo.startDate || "today",
                highlightRangeStart: hotelForm.checkIn,
                highlightRangeEnd: hotelForm.checkOut,
                reservedDates: reservedAccommodationDates,
              }}
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
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
              }}
            />
          </div>
        </div>
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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
              Trip Type
            </label>
            <select
              className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2.5 px-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer"
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
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
              Route (e.g. Airport - Hotel)
            </label>
            <input
              type="text"
              placeholder="e.g. Airport -> Hotel"
              className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2.5 px-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-300"
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
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
            Destination
          </label>
          <input
            type="text"
            placeholder="e.g. Manali"
            className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2.5 px-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-300"
            value={transportForm.destination || ""}
            onChange={(e) =>
              setTransportForm({
                ...transportForm,
                destination: e.target.value,
              })
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
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
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
              Vehicle
            </label>
            <select
              className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer"
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
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
                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <Minus className="w-3 h-3 text-slate-600" />
              </button>
              <span className="font-black text-slate-900 w-4 text-center text-sm">
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
                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <Plus className="w-3 h-3 text-slate-600" />
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
            Any remarks?
          </label>
          <textarea
            placeholder="e.g. Private Transfer, Meet & Greet"
            className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2.5 px-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-300 min-h-20 resize-none"
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
