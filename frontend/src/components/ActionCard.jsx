/**
 * ActionCard Component
 * Renders a Figma-styled navigation card with a header photo, overlapping icon badge,
 * title, and subtitle.
 *
 * @param {Object} props
 * @param {string} props.title - Primary card heading
 * @param {string} props.subtitle - Secondary descriptive text
 * @param {string} props.image - Card header image URL
 * @param {React.ReactNode} props.icon - SVG icon rendered inside the centered badge
 * @param {Function} props.onClick - Click handler callback
 */
export default function ActionCard({ title, subtitle, image, icon, onClick }) {
  return (
    <li className="w-full sm:w-72">
      <button
        type="button"
        onClick={onClick}
        className="w-full h-full bg-white rounded-xl p-4 pb-6 border-2 border-transparent hover:border-[#0B84CF] shadow-md hover:shadow-lg transition-all duration-150 cursor-pointer flex flex-col items-center text-center focus:outline-none focus:border-[#0B84CF]"
      >
        {/* Top Photo + Overlapping White Icon Badge */}
        <div className="relative w-full mb-7">
          <img
            src={image}
            alt=""
            aria-hidden="true"
            className="w-full h-40 object-cover rounded-lg"
          />

          <div
            aria-hidden="true"
            className="w-12 h-12 rounded-lg bg-white shadow-md flex items-center justify-center text-[#0B84CF] absolute left-1/2 -bottom-5 -translate-x-1/2"
          >
            {icon}
          </div>
        </div>

        {/* Card Title & Subtitle */}
        <h2 className="text-lg font-semibold text-black mb-1">{title}</h2>
        <p className="text-xs text-[#5E5E5F] leading-snug">{subtitle}</p>
      </button>
    </li>
  );
}
