import React, { useRef } from "react";
import ReactDatePicker from "react-datepicker";
import { format } from "date-fns";
import { Calendar } from "lucide-react";
import "react-datepicker/dist/react-datepicker.css";
import "./datepicker.css";
import { normalizePickerFormat, parsePickerDate } from "./datePickerFormat";

// The real calendar (react-datepicker + date-fns, ~40 KB compressed). Loaded
// on demand by DatePicker.jsx — import that one, not this file.
const DatePickerFull = ({
  value,
  onChange,
  placeholder = "Select Date",
  enableTime = false,
  dateFormat = "YYYY-MM-DD",
  className = "",
  inputClassName = "",
  options = {},
  minDate,
  maxDate,
  ...props
}) => {
  const pickerRef = useRef(null);
  const normalizeDateFormat = (formatValue) => normalizePickerFormat(formatValue, enableTime);
  const parseToDate = parsePickerDate;

  const handleChange = (date) => {
    if (!date) {
      onChange("");
      return;
    }

    if (enableTime) {
      onChange(format(date, "yyyy-MM-dd HH:mm"));
      return;
    }

    onChange(format(date, "yyyy-MM-dd"));
  };

  const effectiveMinDate = minDate || options.minDate;
  const effectiveMaxDate = maxDate || options.maxDate;
  const selectedDate = parseToDate(value);
  const startDate = parseToDate(options.highlightRangeStart);
  const endDate = parseToDate(options.highlightRangeEnd);
  const reservedDates = (options.reservedDates || [])
    .map((dateValue) => parseToDate(dateValue))
    .filter((dateValue) => dateValue instanceof Date)
    .map((dateValue) =>
      new Date(
        dateValue.getFullYear(),
        dateValue.getMonth(),
        dateValue.getDate(),
      ).getTime(),
    );
  const reservedDateSet = new Set(reservedDates);
  const blackoutDates = (options.blackoutDates || [])
    .map((dateValue) => parseToDate(dateValue))
    .filter((dateValue) => dateValue instanceof Date)
    .map((dateValue) =>
      new Date(
        dateValue.getFullYear(),
        dateValue.getMonth(),
        dateValue.getDate(),
      ).getTime(),
    );
  const blackoutDateSet = new Set(blackoutDates);
  const excludeDates = (options.excludeDates || [])
    .map((dateValue) => parseToDate(dateValue))
    .filter((dateValue) => dateValue instanceof Date);
  const minDateValue =
    effectiveMinDate === "today" ? new Date() : parseToDate(effectiveMinDate);
  const maxDateValue = parseToDate(effectiveMaxDate);
  const pickerDateFormat = normalizeDateFormat(
    options.dateFormat || dateFormat,
  );

  return (
    <div className={`relative ${className} group`}>
      <div className="relative">
        <ReactDatePicker
          selected={selectedDate}
          onChange={handleChange}
          dateFormat={pickerDateFormat}
          showTimeSelect={enableTime}
          timeIntervals={15}
          minDate={minDateValue}
          maxDate={maxDateValue}
          excludeDates={excludeDates}
          startDate={startDate || null}
          endDate={endDate || null}
          calendarStartDay={1}
          placeholderText={placeholder}
          className={`${inputClassName || "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all cursor-pointer font-sans appearance-none"} pr-10`}
          wrapperClassName="w-full"
          portalId="root"
          popperPlacement="bottom-start"
          showPopperArrow={false}
          popperClassName="trip-date-popper"
          dayClassName={(date) => {
            const day = new Date(
              date.getFullYear(),
              date.getMonth(),
              date.getDate(),
            ).getTime();
            const classNames = [];

            if (reservedDateSet.has(day)) {
              classNames.push("trip-reserved-day");
            }

            if (blackoutDateSet.has(day)) {
              classNames.push("trip-blackout-day");
            }

            if (startDate && endDate) {
              const start = new Date(
                startDate.getFullYear(),
                startDate.getMonth(),
                startDate.getDate(),
              ).getTime();
              const end = new Date(
                endDate.getFullYear(),
                endDate.getMonth(),
                endDate.getDate(),
              ).getTime();

              if (day === start || day === end) {
                classNames.push("trip-range-edge");
              } else if (day > start && day < end) {
                classNames.push("trip-range-middle");
              }
            }

            return classNames.join(" ");
          }}
          ref={pickerRef}
          {...props}
        >
          <div className="trip-date-footer">
            {reservedDateSet.size > 0 && (
              <span className="trip-date-legend">
                <i style={{ background: "#2563eb" }} /> Booked
              </span>
            )}
            {blackoutDateSet.size > 0 && (
              <span className="trip-date-legend">
                <i style={{ background: "#f59e0b" }} /> Blackout
              </span>
            )}
            {startDate && endDate && (
              <span className="trip-date-legend">
                <i style={{ background: "var(--color-accent, #b8f0c5)" }} /> Trip dates
              </span>
            )}
            {(() => {
              const today = new Date();
              const floor = minDateValue && new Date(minDateValue.getFullYear(), minDateValue.getMonth(), minDateValue.getDate());
              const ceil = maxDateValue && new Date(maxDateValue.getFullYear(), maxDateValue.getMonth(), maxDateValue.getDate(), 23, 59);
              if ((floor && today < floor) || (ceil && today > ceil)) return null;
              return (
                <button
                  type="button"
                  onClick={() => {
                    handleChange(today);
                    pickerRef.current?.setOpen?.(false);
                  }}
                >
                  Today
                </button>
              );
            })()}
          </div>
        </ReactDatePicker>
        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400 z-0">
          <Calendar size={16} />
        </div>
      </div>

    </div>
  );
};

export default DatePickerFull;
