export default function TextareaField({
  label,
  id,
  value,
  onChange,
  placeholder = "Bei Bedarf eine Anmerkung hinzufügen (max. 500 Zeichen)",
  rows = 3,
  maxLength = 500,
  ...props
}) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-black">
          {label}
        </label>
      )}
      <textarea
        id={id}
        name={id}
        value={value}
        onChange={onChange}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        className="w-full rounded-md border border-gray-500 px-3.5 py-2.5 text-base text-black placeholder-[#B8BBBD] bg-white transition-colors focus:border-[#0B84CF] focus:ring-2 focus:ring-[#0B84CF]/25 focus:outline-none"
        {...props}
      />
    </div>
  );
}
