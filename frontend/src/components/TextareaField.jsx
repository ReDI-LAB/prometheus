export default function TextareaField({
  label,
  id,
  value,
  onChange,
  placeholder = 'Optionale Notiz...',
  rows = 3,
  ...props
}) {
  return (
    <div className="flex flex-col gap-1 w-full">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <textarea
        id={id}
        name={id}
        value={value}
        onChange={onChange}
        rows={rows}
        placeholder={placeholder}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-xs transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        {...props}
      />
    </div>
  );
}