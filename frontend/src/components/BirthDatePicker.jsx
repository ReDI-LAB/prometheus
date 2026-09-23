import { useId } from "react";

/**
 * BirthDatePicker Component
 * Renders three accessible dropdowns (Day, Month, Year) for error-free date selection.
 * Outputs standard ISO date format (YYYY-MM-DD).
 *
 * @param {string} label - Form label
 * @param {string} value - Date string formatted as 'YYYY-MM-DD'
 * @param {Function} onChange - Callback returning the updated 'YYYY-MM-DD' string
 * @param {boolean} required - Whether selection is required
 */
export default function BirthDatePicker({
  label = "Date of birth",
  value = "",
  onChange,
  required = false,
}) {
  const baseId = useId();

  // Split incoming ISO date (YYYY-MM-DD)
  const [valYear = "", valMonth = "", valDay = ""] = value
    ? value.split("-")
    : [];

  // Options generator for Days (1 - 31)
  const days = Array.from({ length: 31 }, (_, i) => {
    const d = String(i + 1).padStart(2, "0");
    return { value: d, label: d };
  });

  // Options for Months (01 - 12)
  const months = [
    { value: "01", label: "01 - Jan" },
    { value: "02", label: "02 - Feb" },
    { value: "03", label: "03 - Mär" },
    { value: "04", label: "04 - Apr" },
    { value: "05", label: "05 - Mai" },
    { value: "06", label: "06 - Jun" },
    { value: "07", label: "07 - Jul" },
    { value: "08", label: "08 - Aug" },
    { value: "09", label: "09 - Sep" },
    { value: "10", label: "10 - Okt" },
    { value: "11", label: "11 - Nov" },
    { value: "12", label: "12 - Dez" },
  ];

  // Options generator for Years (Descending from current year 2026 down to 1930)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1930 + 1 }, (_, i) => {
    const y = String(currentYear - i);
    return { value: y, label: y };
  });

  function updateDate(part, newVal) {
    const current = {
      year: valYear,
      month: valMonth,
      day: valDay,
      [part]: newVal,
    };

    // If all three dropdowns are selected, return full ISO date (YYYY-MM-DD)
    if (current.year && current.month && current.day) {
      onChange(`${current.year}-${current.month}-${current.day}`);
    } else {
      // Partial updates keep format consistent
      onChange(`${current.year}-${current.month}-${current.day}`);
    }
  }

  return (
    <fieldset className="flex flex-col gap-1 border-0 p-0 m-0 w-full">
      <legend className="text-sm font-medium text-gray-700 mb-1">
        {label}{" "}
        {required && (
          <span className="text-red-500 font-bold" aria-hidden="true">
            *
          </span>
        )}
      </legend>

      <div className="grid grid-cols-3 gap-2">
        {/* Day Select */}
        <div>
          <label htmlFor={`${baseId}-day`} className="sr-only">
            Tag
          </label>
          <select
            id={`${baseId}-day`}
            value={valDay}
            onChange={(e) => updateDate("day", e.target.value)}
            required={required}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="" disabled>
              Day
            </option>
            {days.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        {/* Month Select */}
        <div>
          <label htmlFor={`${baseId}-month`} className="sr-only">
            Monat
          </label>
          <select
            id={`${baseId}-month`}
            value={valMonth}
            onChange={(e) => updateDate("month", e.target.value)}
            required={required}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="" disabled>
              Month
            </option>
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Year Select */}
        <div>
          <label htmlFor={`${baseId}-year`} className="sr-only">
            Jahr
          </label>
          <select
            id={`${baseId}-year`}
            value={valYear}
            onChange={(e) => updateDate("year", e.target.value)}
            required={required}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="" disabled>
              Year
            </option>
            {years.map((y) => (
              <option key={y.value} value={y.value}>
                {y.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </fieldset>
  );
}