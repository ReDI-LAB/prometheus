export default function FormButton({
  children,
  type = "button",
  variant = "primary", // 'primary' | 'secondary' | 'dark' | 'danger'
  onClick,
  disabled = false,
  className = "",
}) {
  const baseStyles =
    "px-5 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer focus:outline-none focus:ring-2";

  const variants = {
    primary:
      "bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-400 disabled:bg-blue-300",
    dark: "bg-neutral-800 hover:bg-neutral-900 text-white focus:ring-neutral-500 disabled:bg-neutral-400",
    secondary:
      "bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 focus:ring-gray-300 disabled:text-gray-400",
    danger:
      "bg-red-600 hover:bg-red-700 text-white focus:ring-red-400 disabled:bg-red-300",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant] || variants.primary} ${disabled ? "cursor-not-allowed opacity-60" : ""} ${className}`}
    >
      {children}
    </button>
  );
}