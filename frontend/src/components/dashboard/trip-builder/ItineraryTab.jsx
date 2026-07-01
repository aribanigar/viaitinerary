import React from "react";
import { Image as ImageIcon, MapPin, Trash2 } from "lucide-react";

const ItineraryTab = ({
  availableDestinations,
  itinerary,
  setItinerary,
  removeDay,
  addDayFromDestination,
  formatImageUrl,
}) => {
  return (
    <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
      <div className="flex items-center justify-between gap-4 mb-2">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
          Plan your schedule
        </h3>
        {availableDestinations.length > 0 && (
          <div className="w-64">
            <select
              onChange={(e) => {
                const destId = e.target.value;
                if (destId) {
                  const dest = availableDestinations.find(
                    (d) => String(d.id) === destId,
                  );
                  if (dest) {
                    addDayFromDestination(dest);
                  }
                }
                e.target.value = "";
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-[11px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#c7f135]/10 transition-all cursor-pointer"
            >
              <option value="">+ Add Day from Destination</option>
              {availableDestinations.map((dest) => (
                <option key={dest.id} value={dest.id}>
                  {dest.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {itinerary.map((day) => (
        <div
          key={day.id}
          className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 border-b border-transparent focus-within:border-blue-100 transition-colors mr-4">
              <div className="w-8 h-8 bg-white shadow-sm border border-slate-200 rounded-md flex items-center justify-center text-slate-900 font-bold text-xs shrink-0">
                {day.day}
              </div>
              <select
                value={day.destinationId || ""}
                onChange={(e) => {
                  const destId = e.target.value;
                  if (destId) {
                    const dest = availableDestinations.find(
                      (d) => String(d.id) === destId,
                    );
                    if (dest) {
                      const newItinerary = [...itinerary];
                      const dayIdx = newItinerary.findIndex(
                        (d) => d.id === day.id,
                      );
                      if (dayIdx !== -1) {
                        newItinerary[dayIdx] = {
                          ...newItinerary[dayIdx],
                          title: dest.name,
                          destination: dest.name,
                          destinationId: dest.id,
                          location: dest.name,
                          description: (dest.activities || []).join("\n"),
                          activities: dest.activities || [],
                          photo: dest.image_path || null,
                        };
                        setItinerary(newItinerary);
                      }
                    }
                  }
                }}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-md py-1 px-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#c7f135]/10 transition-all cursor-pointer hover:border-slate-300"
              >
                {!day.destinationId && (
                  <option value="">Select Destination</option>
                )}
                {availableDestinations.map((dest) => (
                  <option key={dest.id} value={dest.id}>
                    {dest.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => removeDay(day.id)}
              className="text-slate-300 hover:text-red-500 transition-colors mr-1"
            >
              <Trash2 className="w-4 h-4 stroke-[1.5]" />
            </button>
          </div>

          <div className="px-6 pb-6 space-y-3">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
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
                className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#c7f135]/20 transition-all placeholder:text-slate-300 shadow-sm"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
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
                className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#c7f135]/20 transition-all placeholder:text-slate-300 shadow-sm"
              />
            </div>

            <div className="bg-white rounded-lg p-4 min-h-24 border border-slate-200 transition-all duration-300 shadow-sm group/text focus-within:ring-2 focus-within:ring-[#c7f135]/20 focus-within:border-[#c7f135]/30">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Activities (one per line)
                </label>
                <span className="text-[9px] text-slate-400 font-bold bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
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
                className="w-full bg-white border-none focus:ring-0 focus:outline-none text-xs font-medium text-slate-600 placeholder:text-slate-300 resize-none min-h-30 custom-scrollbar"
              ></textarea>
            </div>

            <div className="border-2 border-dashed border-slate-100 bg-slate-50/30 rounded-lg p-6 flex flex-col items-center justify-center relative overflow-hidden h-32">
              {day.photo ? (
                <img
                  src={formatImageUrl(day.photo)}
                  alt={`Day ${day.day}`}
                  className="absolute inset-0 w-full h-full object-contain p-2"
                />
              ) : (
                <>
                  <ImageIcon className="w-6 h-6 text-slate-300 mb-2" />
                  <p className="text-[11px] font-bold text-slate-400">
                    No image for this destination
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      ))}

      {itinerary.length === 0 && (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-12 text-center">
          <MapPin className="w-10 h-10 text-slate-300 mx-auto mb-4" />
          <p className="text-sm font-bold text-slate-400">
            No days added. Use the "Add Saved Destination" button above to
            start.
          </p>
        </div>
      )}
    </div>
  );
};

export default ItineraryTab;
