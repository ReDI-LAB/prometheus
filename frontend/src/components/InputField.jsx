/**
 * Reusable InputField Component
 * Supports text, numeric, date, and time inputs with optional character filtering and clear button.
 *
 * @param {Object} props
 * @param {string} props.id - Unique input identifier
 * @param {string} props.label - Visible German label text
 * @param {string} [props.type] - HTML input type (default: "text")
 * @param {string} [props.value] - Controlled input value
 * @param {Function} [props.onChange] - Change event handler
 * @param {Function} [props.onClear] - Optional clear callback showing an inline "✕" button when filled
 * @param {string} [props.placeholder] - Placeholder text
 * @param {boolean} [props.required] - Marks field as mandatory with red asterisk
 * @param {boolean} [props.readOnly] - Makes input read-only
 * @param {boolean} [props.onlyLetters] - Restricts input to alphabetic characters, spaces, and hyphens
 * @param {boolean} [props.onlyNumbers] - Restricts input to digits (0-9)
 * @param {number} [props.maxLength] - Maximum character length
 * @param {string} [props.min] - Minimum value (for time/number/date inputs)
 * @param {string} [props.autoComplete] - HTML autocomplete attribute
 * @param {string} [props.autoCapitalize] - HTML autocapitalize attribute
 * @param {boolean} [props.spellCheck] - HTML spellcheck attribute
 */
export default function InputField({
  id,
  label,
  type = "text",
  value = "",
  onChange,
  onClear,
  placeholder = "",
  required = false,
  readOnly = false,
  onlyLetters = false,
  onlyNumbers = false,
  maxLength,
  min,
  autoComplete,
  autoCapitalize,
  spellCheck,
}) {
  function handleFilteredChange(e) {
    let nextValue = e.target.value;

    if (onlyLetters) {
      nextValue = nextValue.replace(/[^a-zA-ZäöüÄÖÜß\s-]/g, "");
    }
    if (onlyNumbers) {
      nextValue = nextValue.replace(/\D/g, "");
    }
    if (maxLength) {
      nextValue = nextValue.slice(0, maxLength);
    }

    onChange?.({
      ...e,
      target: {
        ...e.target,
        value: nextValue,
      },
    });
  }

  const showClearButton = typeof onClear === "function" && Boolean(value);

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
        <input
          id={id}
          type={type}
          value={value}
          onChange={handleFilteredChange}
          placeholder={placeholder}
          required={required}
          readOnly={readOnly}
          maxLength={maxLength}
          min={min}
          autoComplete={autoComplete}
          autoCapitalize={autoCapitalize}
          spellCheck={spellCheck}
          className={`h-11 w-full rounded-md border border-gray-500 px-3.5 py-2 text-base text-black placeholder-[#B8BBBD] transition-colors focus:border-[#0B84CF] focus:ring-2 focus:ring-[#0B84CF]/25 focus:outline-none ${
            showClearButton ? "pr-9" : ""
          } ${readOnly ? "bg-gray-50 cursor-default" : "bg-white"}`}
        />

        {showClearButton && (
          <button
            type="button"
            onClick={onClear}
            aria-label={`${label || "Feld"} löschen`}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black text-xs p-1 cursor-pointer"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
