import React from "react";
import DatePicker from "./DatePicker";

// Drop-in for <input type="date">: same value ("yyyy-MM-dd") and the same
// onChange(event) shape (e.target.value), but it opens the app's calendar
// instead of the browser's, so every date field looks and works alike.
const DateInput = ({ value, onChange, className = "", wrapClassName = "w-full", min, max, placeholder = "Select date", disabled, name }) => (
  <DatePicker
    value={value || ""}
    onChange={(v) => onChange?.({ target: { value: v, name } })}
    minDate={min || undefined}
    maxDate={max || undefined}
    placeholder={placeholder}
    disabled={disabled}
    className={wrapClassName}
    inputClassName={className}
    options={{ dateFormat: "d-m-Y" }}
  />
);

export default DateInput;
