/**
 * ActionCard Component
 * Accessible card-button for top-level dashboard navigation.
 *
 * @param {Object} props
 * @param {string} props.label - Card title text displayed on the button
 * @param {Function} props.onClick - Navigation callback fired on button click
 */
export default function ActionCard({ label, onClick }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-[15rem] h-64 bg-white hover:bg-gray-300 rounded-2xl text-3xl font-medium text-gray-800 text-center flex items-center justify-center cursor-pointer transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {label}
      </button>
    </li>
  );
}
