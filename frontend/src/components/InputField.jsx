export default function InputField({
  label,
  id,
  type = "text",
  value,
  onChange,
  required = false,
  placeholder = "",
  disabled = false,
  readOnly = false,
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
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        className={`w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-xs transition-colors
          focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 focus:outline-none
          ${readOnly ? "bg-gray-50 text-gray-700 cursor-default select-all" : "bg-white"}
          disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed`}
        {...props}
      />
    </div>
  );
}