/**
 * FormButton Component
 * Standardized button styling matching Sahu's Figma Hi-Fi specification.
 */
export default function FormButton({
  children,
  type = "button",
  variant = "primary", // 'primary' | 'secondary' | 'dark' | 'danger' | 'ghost'
  onClick,
  disabled = false,
  className = "",
}) {
  const baseStyles =
    "px-7 py-2.5 text-base font-medium rounded-lg transition-all cursor-pointer focus:outline-none";

  const variants = {
    primary:
      "bg-[#0B84CF] hover:bg-[#05619A] text-white font-semibold shadow-sm disabled:opacity-50",
    dark: "bg-[#0B84CF] hover:bg-[#05619A] text-white font-semibold shadow-sm disabled:opacity-50",
    secondary:
      "bg-white hover:bg-gray-50 text-black border border-gray-300 shadow-2xs disabled:text-gray-400",
    ghost: "bg-transparent hover:bg-gray-100 text-black px-3 py-2",
    danger:
      "bg-[#B71D1D] hover:opacity-90 text-white font-semibold disabled:opacity-50",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant] || variants.primary} ${
        disabled ? "cursor-not-allowed" : ""
      } ${className}`}
    >
      {children}
    </button>
  );
}
