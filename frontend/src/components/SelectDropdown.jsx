export default function SelectDropdown({
  label,
  id,
  value,
  onChange,
  options = [], // Format: [{ value: 'm', label: 'Male' }] oder einfache Strings
  required = false,
  placeholder = "Bitte wählen...",
  disabled = false,
  ...props
}) {
  return (
    <div className="flex flex-col gap-1 w-full">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-gray-700">
          {label}{" "}
          {required && (
            <span className="text-red-500 font-bold" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      <select
        id={id}
        name={id}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        className={`w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white shadow-xs transition-colors
          focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none
          disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed`}
        {...props}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((opt) => {
          const val = typeof opt === "object" ? opt.value : opt;
          const lbl = typeof opt === "object" ? opt.label : opt;
          return (
            <option key={val} value={val}>
              {lbl}
            </option>
          );
        })}
      </select>
    </div>
  );
}