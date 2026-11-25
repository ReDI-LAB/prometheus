export default function RadioGroup({
  label,
  name,
  value,
  onChange,
  options = [],
  required = false,
  hideLabel = false,
}) {
  return (
    <fieldset className="flex flex-col gap-2 border-0 p-0 m-0">
      {label && (
        <legend
          className={
            hideLabel ? "sr-only" : "text-sm font-medium text-black mb-1"
          }
        >
          {label}
          {required && (
            <span
              className="text-[#B71D1D] font-bold ml-0.5"
              aria-hidden="true"
            >
              *
            </span>
          )}
        </legend>
      )}

      <div
        role="radiogroup"
        className="flex flex-wrap items-center gap-12 pt-1"
      >
        {options.map((opt) => {
          const optValue = typeof opt === "object" ? opt.value : opt;
          const optLabel = typeof opt === "object" ? opt.label : opt;
          const inputId = `${name}-${optValue}`;

          return (
            <label
              key={optValue}
              htmlFor={inputId}
              className="flex items-center gap-2.5 cursor-pointer text-base text-black select-none"
            >
              <input
                id={inputId}
                name={name}
                type="radio"
                value={optValue}
                checked={value === optValue}
                onChange={onChange}
                required={required}
                className="w-5 h-5 accent-[#0B84CF] border-black cursor-pointer"
              />
              <span>{optLabel}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
