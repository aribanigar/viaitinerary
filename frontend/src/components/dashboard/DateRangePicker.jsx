import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Calendar } from "lucide-react";

const DateRangePicker = ({ onApply, className }) => {
  const presets = [
    {
      key: "Today",
      label: "Today",
      range: () => {
        const d = new Date();
        return { start: new Date(d), end: new Date(d) };
      },
    },
    {
      key: "Yesterday",
      label: "Yesterday",
      range: () => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return { start: new Date(d), end: new Date(d) };
      },
    },
    {
      key: "Last7",
      label: "Last 7 Days",
      range: () => {
        const e = new Date();
        const s = new Date();
        s.setDate(e.getDate() - 6);
        return { start: s, end: e };
      },
    },
    {
      key: "Last30",
      label: "Last 30 Days",
      range: () => {
        const e = new Date();
        const s = new Date();
        s.setDate(e.getDate() - 29);
        return { start: s, end: e };
      },
    },
    {
      key: "ThisMonth",
      label: "This Month",
      range: () => {
        const e = new Date();
        const s = new Date(e.getFullYear(), e.getMonth(), 1);
        return { start: s, end: e };
      },
    },
    {
      key: "LastMonth",
      label: "Last Month",
      range: () => {
        const now = new Date();
        const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const last = new Date(now.getFullYear(), now.getMonth(), 0);
        return { start: first, end: last };
      },
    },
    { key: "All", label: "All", range: () => ({ start: null, end: null }) },
    { key: "Custom", label: "Custom Range >>", range: null },
  ];

  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const ref = useRef(null);
  const menuRef = useRef(null);
  const [selectedPreset, setSelectedPreset] = useState("Today");
  const [start, setStart] = useState(() => new Date());
  const [end, setEnd] = useState(() => new Date());
  const [customMode, setCustomMode] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());

  useEffect(() => {
    function onDoc(e) {
      if (!ref.current) return;
      const target = e.target;
      if (ref.current.contains(target)) return;
      if (menuRef.current && menuRef.current.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (open && ref.current) {
      const r = ref.current.getBoundingClientRect();
      const viewportWidth =
        document.documentElement.clientWidth || window.innerWidth;
      const preferredLeft = r.left + window.scrollX;
      const dropdownWidth = customMode ? 650 : 180;
      const minLeft = window.scrollX + 12;
      const maxLeft = window.scrollX + viewportWidth - dropdownWidth - 12;
      const left = Math.min(
        Math.max(preferredLeft, minLeft),
        Math.max(minLeft, maxLeft),
      );
      setMenuPos({
        top: r.bottom + window.scrollY,
        left,
        width: r.width,
        dropdownWidth,
      });
    }
  }, [open, customMode]);

  const fmt = (d) => (d ? d.toLocaleDateString() : "All");

  const applyPreset = (p) => {
    if (p.key === "Custom") {
      setCustomMode(true);
      setSelectedPreset("Custom");
      return;
    }
    setCustomMode(false);
    setSelectedPreset(p.key);
    const r = p.range();
    setStart(r.start);
    setEnd(r.end);
    setOpen(false);
    if (onApply) onApply({ start: r.start, end: r.end });
  };

  const handleSubmit = () => {
    setOpen(false);
    if (onApply) onApply({ start, end });
  };
  const handleCancel = () => {
    setOpen(false);
    setCustomMode(false);
  };

  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const renderCalendar = (monthDate) => {
    const daysInMonth = getDaysInMonth(monthDate);
    const firstDay = getFirstDayOfMonth(monthDate);
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return days;
  };

  const isDateSelected = (day, monthDate) => {
    if (!day) return false;
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
    return (
      (start && date.toDateString() === start.toDateString()) ||
      (end && date.toDateString() === end.toDateString())
    );
  };

  const isDateInRange = (day, monthDate) => {
    if (!day || !start || !end) return false;
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
    return date >= start && date <= end;
  };

  const handleDateClick = (day, monthDate) => {
    if (!day) return;
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
    if (!start) {
      setStart(date);
    } else if (!end) {
      if (date < start) {
        setStart(date);
      } else {
        setEnd(date);
      }
    } else {
      // Both start and end are set, reset to new selection
      setStart(date);
      setEnd(null);
    }
  };

  const prevMonth = () => {
    setCalendarMonth(
      new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1),
    );
  };

  const nextMonth = () => {
    setCalendarMonth(
      new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1),
    );
  };

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  const days = renderCalendar(calendarMonth);
  const nextMonthDate = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth() + 1,
  );
  const nextDays = renderCalendar(nextMonthDate);

  return (
    <div className={(className || "") + " relative inline-block"} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md border bg-white hover:shadow-sm"
      >
        <Calendar className="w-4 h-4 text-neutral-700" />
        <span className="text-sm">
          {selectedPreset === "Custom"
            ? `${fmt(start)} - ${fmt(end)}`
            : selectedPreset || "Date Range"}
        </span>
        <svg
          className="w-3 h-3 ml-1 text-neutral-400"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden
        >
          <path
            d="M6 8l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "absolute",
              top: menuPos.top + "px",
              left: menuPos.left + "px",
              width: menuPos.dropdownWidth + "px",
            }}
            className="bg-white border rounded shadow-lg z-50 flex"
          >
            <div className="w-40 border-r px-3 py-2">
              {presets.map((p) => (
                <div
                  key={p.key}
                  className={`py-2 cursor-pointer text-sm rounded px-2 ${
                    selectedPreset === p.key
                      ? p.key === "Custom"
                        ? "font-medium bg-[#c7f135] text-[#10182a]"
                        : "font-medium text-blue-600"
                      : "text-neutral-700"
                  }`}
                  onClick={() => applyPreset(p)}
                >
                  {p.label}
                </div>
              ))}
            </div>

            {customMode && (
              <div className="flex-1 px-4 py-3 flex flex-col">
                <div className="flex justify-between gap-8 mb-4">
                  {/* Current Month */}
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-3">
                      <button
                        type="button"
                        onClick={prevMonth}
                        className="text-neutral-600 hover:text-neutral-900 text-lg"
                      >
                        &lt;
                      </button>
                      <span className="text-sm font-semibold text-neutral-900">
                        {monthNames[calendarMonth.getMonth()]}{" "}
                        {calendarMonth.getFullYear()}
                      </span>
                      <button
                        type="button"
                        onClick={prevMonth}
                        className="text-neutral-600 hover:text-neutral-900 text-lg invisible"
                      >
                        &lt;
                      </button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center text-xs">
                      {dayNames.map((d) => (
                        <div key={d} className="font-semibold text-neutral-600">
                          {d}
                        </div>
                      ))}
                      {days.map((day, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleDateClick(day, calendarMonth)}
                          disabled={!day}
                          className={`py-1 rounded font-semibold ${
                            !day
                              ? "text-neutral-300 cursor-default"
                              : isDateSelected(day, calendarMonth)
                                ? "bg-[#c7f135] text-[#10182a]"
                                : isDateInRange(day, calendarMonth)
                                  ? "bg-blue-100 text-neutral-900"
                                  : "text-neutral-600 hover:bg-neutral-100 cursor-pointer"
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Next Month */}
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-3">
                      <button
                        type="button"
                        onClick={nextMonth}
                        className="text-neutral-600 hover:text-neutral-900 text-lg invisible"
                      >
                        &gt;
                      </button>
                      <span className="text-sm font-semibold text-neutral-900">
                        {monthNames[nextMonthDate.getMonth()]}{" "}
                        {nextMonthDate.getFullYear()}
                      </span>
                      <button
                        type="button"
                        onClick={nextMonth}
                        className="text-neutral-600 hover:text-neutral-900 text-lg"
                      >
                        &gt;
                      </button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center text-xs">
                      {dayNames.map((d) => (
                        <div key={d} className="font-semibold text-neutral-600">
                          {d}
                        </div>
                      ))}
                      {nextDays.map((day, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleDateClick(day, nextMonthDate)}
                          disabled={!day}
                          className={`py-1 rounded font-semibold ${
                            !day
                              ? "text-neutral-300 cursor-default"
                              : isDateSelected(day, nextMonthDate)
                                ? "bg-[#c7f135] text-[#10182a]"
                                : isDateInRange(day, nextMonthDate)
                                  ? "bg-blue-100 text-neutral-900"
                                  : "text-neutral-600 hover:bg-neutral-100 cursor-pointer"
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="border-t pt-3 flex justify-between items-center">
                  <span className="text-sm text-neutral-600">
                    {start ? start.toLocaleDateString() : "Select"} -{" "}
                    {end ? end.toLocaleDateString() : "Select"}
                  </span>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="px-3 py-1 rounded border text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      className="px-3 py-1 rounded bg-[#c7f135] text-[#10182a] text-sm"
                    >
                      Submit
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
};

export default DateRangePicker;
