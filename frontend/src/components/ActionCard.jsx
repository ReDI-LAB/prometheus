/**
 * ActionCard Component
 * Accessible dashboard navigation card matching Sahu's Figma Hi-Fi design.
 *
 * @param {Object} props
 * @param {string} props.title - Main card title in primary brand blue
 * @param {string} props.subtitle - Secondary descriptive subtitle
 * @param {React.ReactNode} props.icon - SVG icon element rendered above the title
 * @param {Function} props.onClick - Navigation callback fired on button click
 */
export default function ActionCard({ title, subtitle, icon, onClick }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-64 h-60 bg-white hover:bg-[#EAF2FF]/60 rounded-2xl px-6 py-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all shadow-sm hover:shadow-md border border-white hover:border-[#0B84CF]/30"
        style={{ color: "var(--color-brand-primary)" }}
      >
        <div className="mb-4" aria-hidden="true">
          {icon}
        </div>
        <span className="text-2xl font-semibold tracking-tight mb-1.5">
          {title}
        </span>
        {subtitle && (
          <span className="text-xs font-normal leading-snug">{subtitle}</span>
        )}
      </button>
    </li>
  );
}
