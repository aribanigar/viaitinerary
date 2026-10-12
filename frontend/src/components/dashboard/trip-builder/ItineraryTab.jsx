import React, { useState } from "react";
import { GripVertical, Image as ImageIcon, MapPin, Trash2 } from "lucide-react";
import { destinationActivityLabels } from "../../../utils/destinationActivities";
import DestinationPicker from "./DestinationPicker";

const ItineraryTab = ({
  availableDestinations,
  itinerary,
  setItinerary,
  removeDay,
  addDayFromDestination,
  formatImageUrl,
  moveDay,
}) => {
  // Drag a day by its handle (or pick "Move to day N" — easier on a long
  // trip). moveDay re-dates the day's hotel, cabs and activities with it.
  const [dragFrom, setDragFrom] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const endDrag = () => {
    setDragFrom(null);
    setDragOver(null);
  };
  return (
    <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
      <div className="flex items-center justify-between gap-4 mb-2">
        <h3 className="text-[10px] font-semibold text-[#9aa3b2] uppercase tracking-[0.2em]">
          Plan your schedule
        </h3>
        {/* Always shown: with no destinations loaded it says so (and links to
            Destinations) instead of disappearing. */}
        <div className="w-64">
          <DestinationPicker
            destinations={availableDestinations}
            value=""
            onSelect={(dest) => addDayFromDestination(dest)}
            placeholder="+ Add Day from Destination"
          />
        </div>
      </div>

      {itinerary.map((day, index) => (
        <div
          key={day.id}
          onDragOver={(e) => {
            if (dragFrom == null) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (dragOver !== index) setDragOver(index);
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragFrom != null && dragFrom !== index) moveDay?.(dragFrom + 1, index + 1);
            endDrag();
          }}
          className={`bg-white border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all ${
            dragOver === index && dragFrom !== index
              ? dragFrom < index
                ? "border-accent shadow-[0_3px_0_0_var(--color-accent)]"
                : "border-accent shadow-[0_-3px_0_0_var(--color-accent)]"
              : "border-black/5"
          } ${dragFrom === index ? "opacity-40" : ""}`}
        >
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 border-b border-transparent focus-within:border-black/5 transition-colors mr-4">
              {moveDay && itinerary.length > 1 && (
                <span
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", String(index));
                    setDragFrom(index);
                  }}
                  onDragEnd={endDrag}
                  title="Drag to move this day"
                  className="cursor-grab active:cursor-grabbing text-[#c9ced6] hover:text-ink -ml-1"
                >
                  <GripVertical className="w-4 h-4" />
                </span>
              )}
              <div className="w-8 h-8 bg-white shadow-sm border border-black/10 rounded-md flex items-center justify-center text-ink font-bold text-xs shrink-0">
                {day.day}
              </div>
              <DestinationPicker
                className="flex-1"
                destinations={availableDestinations}
                value={day.destinationId || ""}
                placeholder="Select Destination"
                onSelect={(dest) => {
                  const newItinerary = [...itinerary];
                  const dayIdx = newItinerary.findIndex((d) => d.id === day.id);
                  if (dayIdx !== -1) {
                    const activityLabels = destinationActivityLabels(
                      dest.activities,
                    );
                    newItinerary[dayIdx] = {
                      ...newItinerary[dayIdx],
                      title: dest.name,
                      destination: dest.name,
                      destinationId: dest.id,
                      location: dest.name,
                      description: activityLabels.join("\n"),
                      activities: activityLabels,
                      photo: dest.image_path || null,
                    };
                    setItinerary(newItinerary);
                  }
                }}
              />
            </div>
            {moveDay && itinerary.length > 1 && (
              <select
                value=""
                onChange={(e) => {
                  const to = Number(e.target.value);
                  if (to) moveDay(index + 1, to);
                }}
                title="Move this day"
                className="mr-3 bg-white border border-black/10 rounded-lg py-1 px-2 text-[11px] font-semibold text-ink/60 focus:outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer"
              >
                <option value="">Move to…</option>
                {itinerary.map((_, i) =>
                  i === index ? null : (
                    <option key={i} value={i + 1}>
                      Day {i + 1}
                    </option>
                  ),
                )}
              </select>
            )}
            <button
              onClick={() => removeDay(day.id)}
              className="text-[#c9ced6] hover:text-red-500 transition-colors mr-1"
            >
              <Trash2 className="w-4 h-4 stroke-[1.5]" />
            </button>
          </div>

          <div className="px-6 pb-6 space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-ink/45 uppercase tracking-[0.12em] mb-1.5 ml-1">
                Route (e.g. City A to City B)
              </label>
              <input
                type="text"
                placeholder="Enter day title..."
                value={day.title || ""}
                onChange={(e) => {
                  const newItinerary = [...itinerary];
                  const dayIdx = newItinerary.findIndex((d) => d.id === day.id);
                  if (dayIdx !== -1) {
                    newItinerary[dayIdx].title = e.target.value;
                    setItinerary(newItinerary);
                  }
                }}
                className="w-full bg-white border border-black/10 rounded-xl py-2.5 px-4 text-sm font-medium text-ink focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all placeholder:text-[#c9ced6] shadow-sm"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-ink/45 uppercase tracking-[0.12em] mb-1.5 ml-1">
                Stay Location (e.g. Overnight stay in the city)
              </label>
              <input
                type="text"
                placeholder="Enter location name..."
                value={day.location || ""}
                onChange={(e) => {
                  const newItinerary = [...itinerary];
                  const dayIdx = newItinerary.findIndex((d) => d.id === day.id);
                  if (dayIdx !== -1) {
                    newItinerary[dayIdx].location = e.target.value;
                    setItinerary(newItinerary);
                  }
                }}
                className="w-full bg-white border border-black/10 rounded-xl py-2.5 px-4 text-sm font-medium text-ink focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all placeholder:text-[#c9ced6] shadow-sm"
              />
            </div>

            <div className="bg-white rounded-lg p-4 min-h-24 border border-black/10 transition-all duration-300 shadow-sm group/text focus-within:ring-2 focus-within:ring-accent/20 focus-within:border-accent/30">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-[10px] font-semibold text-[#9aa3b2] uppercase tracking-widest">
                  Activities (one per line)
                </label>
                <span className="text-[9px] text-[#9aa3b2] font-bold bg-[#f3f3f4] px-2 py-0.5 rounded-full border border-black/5">
                  Click to Edit
                </span>
              </div>
              <textarea
                placeholder="Enter activities for this day..."
                value={day.description || ""}
                onChange={(e) => {
                  const newItinerary = [...itinerary];
                  const dayIdx = newItinerary.findIndex((d) => d.id === day.id);
                  if (dayIdx !== -1) {
                    const newVal = e.target.value;
                    newItinerary[dayIdx].description = newVal;
                    newItinerary[dayIdx].activities = newVal
                      .split("\n")
                      .filter((a) => a.trim() !== "");
                    setItinerary(newItinerary);
                  }
                }}
                className="w-full bg-white border-none focus:ring-0 focus:outline-none text-xs font-medium text-[#5b6472] placeholder:text-[#c9ced6] resize-none min-h-30 custom-scrollbar"
              ></textarea>
            </div>

            <div className="border-2 border-dashed border-black/5 bg-[#f3f3f4]/30 rounded-lg p-6 flex flex-col items-center justify-center relative overflow-hidden h-32">
              {day.photo ? (
                <img
                  src={formatImageUrl(day.photo)}
                  alt={`Day ${day.day}`}
                  className="absolute inset-0 w-full h-full object-contain p-2"
                />
              ) : (
                <>
                  <ImageIcon className="w-6 h-6 text-[#c9ced6] mb-2" />
                  <p className="text-[11px] font-bold text-[#9aa3b2]">
                    No image for this destination
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      ))}

      {itinerary.length === 0 && (
        <div className="bg-[#f3f3f4] border-2 border-dashed border-black/10 rounded-xl p-12 text-center">
          <MapPin className="w-10 h-10 text-[#c9ced6] mx-auto mb-4" />
          <p className="text-sm font-bold text-[#9aa3b2]">
            No days added. Use the "Add Saved Destination" button above to
            start.
          </p>
        </div>
      )}
    </div>
  );
};

export default ItineraryTab;
