export default function SelectDropdown({
  label,
  id,
  value,
  onChange,
  options = [],
  required = false,
  placeholder = "Bitte wählen",
  disabled = false,
  ...props
}) {
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
      <select
        id={id}
        name={id}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        className={`h-11 w-full rounded-md border border-gray-500 px-3.5 py-2 text-base bg-white transition-colors
          ${value === "" ? "text-[#B8BBBD]" : "text-black"}
          focus:border-[#0B84CF] focus:ring-2 focus:ring-[#0B84CF]/25 focus:outline-none
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
            <option key={val} value={val} className="text-black">
              {lbl}
            </option>
          );
        })}
      </select>
    </div>
  );
}
