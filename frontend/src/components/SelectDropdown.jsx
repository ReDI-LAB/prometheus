/**
 * Reusable SelectDropdown Component
 * Renders a styled native select dropdown with optional clear ("✕") button.
 *
 * @param {Object} props
 * @param {string} props.id - Unique select identifier
 * @param {string} [props.label] - Visible German label text
 * @param {string|number} [props.value] - Currently selected option value
 * @param {Function} [props.onChange] - Change event handler
 * @param {Function} [props.onClear] - Optional clear callback showing an inline "✕" button when filled
 * @param {Array<{value: string|number, label: string}>} [props.options] - Dropdown items
 * @param {string} [props.placeholder] - Placeholder option shown when value is empty
 * @param {boolean} [props.required] - Marks field as mandatory with red asterisk
 */
export default function SelectDropdown({
  id,
  label,
  value = "",
  onChange,
  onClear,
  options = [],
  placeholder = "Bitte wählen",
  required = false,
}) {
  const showClearButton =
    typeof onClear === "function" && value !== "" && value !== null;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-black">
          {label}
          {required && (
            <span
              className="text-[#B71D1D] font-bold ml-0.5"
              aria-hidden="true"
            >
              *
            </span>
          )}
        </label>
      )}

      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={onChange}
          required={required}
          className={`h-11 w-full appearance-none rounded-md border border-gray-500 bg-white px-3.5 py-2 pr-9 text-base transition-colors focus:border-[#0B84CF] focus:ring-2 focus:ring-[#0B84CF]/25 focus:outline-none ${
            value === "" ? "text-[#B8BBBD]" : "text-black"
          }`}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              className="text-black bg-white"
            >
              {opt.label}
            </option>
          ))}
        </select>

        {showClearButton ? (
          <button
            type="button"
            onClick={onClear}
            aria-label={`${label || "Auswahl"} zurücksetzen`}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black text-xs p-1 cursor-pointer"
          >
            ✕
          </button>
        ) : (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 text-xs"
          >
            ▾
          </span>
        )}
      </div>
    </div>
  );
}
