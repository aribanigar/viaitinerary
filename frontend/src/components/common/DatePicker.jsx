import React, { useEffect, useState } from "react";
import { Calendar } from "lucide-react";
import { afterLoad } from "../../utils/afterLoad";
import { formatPickerDate, normalizePickerFormat, parsePickerDate } from "./datePickerFormat";

// Every date field in the app. The real calendar (DatePickerFull.jsx:
// react-datepicker + date-fns, ~40 KB compressed) is NOT on any screen's first
// load: until it arrives this renders the same-looking input showing the date,
// fetches the calendar once the browser is idle, and swaps it in. A tap on the
// field before then loads it at once and opens it. Same props as before.
let Full = null;
let pending = null;
const loadFull = () =>
  pending ||
  (pending = import("./DatePickerFull").then((m) => {
    Full = m.default;
    return Full;
  }));

const DEFAULT_INPUT =
  "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all cursor-pointer font-sans appearance-none";

const DatePicker = (props) => {
  const [, setLoaded] = useState(!!Full);
  const [openNow, setOpenNow] = useState(false);

  useEffect(() => {
    if (Full) return undefined;
    let alive = true;
    const go = () =>
      loadFull()
        .then(() => alive && setLoaded(true))
        .catch(() => {
          pending = null; // a failed fetch is retried on the next tap
        });
    const cancel = afterLoad(go);
    return () => {
      alive = false;
      cancel();
    };
  }, []);

  if (Full) return <Full {...props} startOpen={openNow || props.startOpen} />;

  const {
    value,
    placeholder = "Select Date",
    enableTime = false,
    dateFormat = "YYYY-MM-DD",
    className = "",
    inputClassName = "",
    options = {},
    disabled,
    id,
    name,
    required,
  } = props;
  const shown = formatPickerDate(parsePickerDate(value), normalizePickerFormat(options.dateFormat || dateFormat, enableTime));
  const open = () => {
    if (disabled) return;
    setOpenNow(true);
    loadFull()
      .then(() => setLoaded(true))
      .catch(() => {
        pending = null;
      });
  };
  return (
    <div className={`relative ${className} group`}>
      <div className="relative">
        <div className="w-full">
          <input
            type="text"
            readOnly
            id={id}
            name={name}
            required={required}
            disabled={disabled}
            value={shown}
            placeholder={placeholder}
            onFocus={open}
            onClick={open}
            onTouchStart={open}
            className={`${inputClassName || DEFAULT_INPUT} pr-10`}
          />
        </div>
        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400 z-0">
          <Calendar size={16} />
        </div>
      </div>
    </div>
  );
};

export default DatePicker;
