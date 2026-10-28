export default function InputField({
  label,
  id,
  type = "text",
  value,
  onChange,
  required = false,
  onlyNumbers = false, // Ziffern-Filter
  onlyLetters = false, // Buchstaben-Filter
  maxLength,
  disabled = false,
  readOnly = false,
  className = "",
  ...props
}) {
  function handleInputChange(e) {
    let val = e.target.value;

    if (onlyNumbers) {
      // Entfernt alles außer Ziffern (0-9)
      val = val.replace(/\D/g, "");
    } else if (onlyLetters) {
      // Entfernt alles außer Buchstaben, Umlauten, ß, Leerzeichen und Bindestrichen
      val = val.replace(/[^a-zA-ZäöüÄÖÜß -]/g, "");
    }

    if (maxLength) {
      val = val.slice(0, maxLength);
    }

    e.target.value = val;
    onChange?.(e);
  }

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
        onChange={handleInputChange}
        required={required}
        maxLength={maxLength}
        disabled={disabled}
        readOnly={readOnly}
        inputMode={onlyNumbers ? "numeric" : undefined}
        pattern={onlyNumbers ? "[0-9]*" : undefined}
        className={`h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-xs transition-colors
          ${
            readOnly
              ? "bg-gray-50 text-gray-700 cursor-default select-all focus:outline-none"
              : "bg-white focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 focus:outline-none"
          }
          disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed
          ${className}`}
        {...props}
      />
    </div>
  );
}
