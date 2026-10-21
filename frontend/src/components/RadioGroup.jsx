/**
 * RadioGroup Component
 * Accessible radio button group with keyboard navigation and focus rings.
 *
 * @param {string} label - Group title/legend
 * @param {string} name - Shared HTML input name for mutual exclusivity
 * @param {string} value - Currently selected value
 * @param {Function} onChange - Callback function when selection changes
 * @param {Array<{ value: string, label: string }>} options - Available radio options
 * @param {boolean} required - Whether selection is required
 */
export default function RadioGroup({
  label,
  name,
  value,
  onChange,
  options = [],
  required = false,
}) {
  return (
    <fieldset className="flex flex-col gap-2 border-0 p-0 m-0">
      {label && (
        <legend className="text-sm font-medium text-gray-700 mb-1">
          {label}{" "}
          {required && (
            <span className="text-red-500 font-bold" aria-hidden="true">
              *
            </span>
          )}
        </legend>
      )}

      <div role="radiogroup" className="flex items-center gap-6">
        {options.map((opt) => {
          const optValue = typeof opt === "object" ? opt.value : opt;
          const optLabel = typeof opt === "object" ? opt.label : opt;
          const inputId = `${name}-${optValue}`;

          return (
            <label
              key={optValue}
              htmlFor={inputId}
              className="flex items-center gap-2 cursor-pointer text-sm text-gray-800 select-none"
            >
              <input
                id={inputId}
                name={name}
                type="radio"
                value={optValue}
                checked={value === optValue}
                onChange={onChange}
                required={required}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 focus:ring-2 cursor-pointer"
              />
              <span>{optLabel}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}