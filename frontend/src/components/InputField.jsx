export default function InputField({
  label,
  id,
  type = "text",
  value,
  onChange,
  required = false,
  onlyNumbers = false,
  onlyLetters = false,
  maxLength,
  disabled = false,
  readOnly = false,
  className = "",
  ...props
}) {
  function handleInputChange(e) {
    let val = e.target.value;

    if (onlyNumbers) {
      val = val.replace(/\D/g, "");
    } else if (onlyLetters) {
      val = val.replace(/[^a-zA-ZäöüÄÖÜß -]/g, "");
    }

    if (maxLength) {
      val = val.slice(0, maxLength);
    }

    e.target.value = val;
    onChange?.(e);
  }

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
        className={`h-11 w-full rounded-md border border-gray-500 px-3.5 py-2 text-base text-black placeholder-[#B8BBBD] transition-colors
          ${
            readOnly
              ? "bg-gray-50 text-[#5E5E5F] cursor-default select-all focus:outline-none"
              : "bg-white focus:border-[#0B84CF] focus:ring-2 focus:ring-[#0B84CF]/25 focus:outline-none"
          }
          disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed
          ${className}`}
        {...props}
      />
    </div>
  );
}
