import { useState } from "react";

/**
 * Accordion Component
 * Accessible collapsible section for optional details (e.g., Emergency Contact).
 *
 * @param {string} title - Label shown in header
 * @param {boolean} defaultOpen - Initial collapsed/expanded state
 * @param {React.ReactNode} children - Form inputs inside the collapsible drawer
 */
export default function Accordion({ title, defaultOpen = false, children }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = `accordion-content-${title.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <section className="w-full border border-gray-200 rounded-md bg-white overflow-hidden transition-shadow">
      {/* Header toggle button */}
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between p-3.5 bg-gray-50 hover:bg-gray-100 text-left cursor-pointer transition-colors"
      >
        <span className="text-sm font-semibold text-gray-800">{title}</span>
        <span
          aria-hidden="true"
          className={`text-gray-500 text-xs transition-transform duration-200 ${
            isOpen ? "rotate-180" : "rotate-0"
          }`}
        >
          ▼
        </span>
      </button>

      {/* Collapsible content drawer */}
      {isOpen && (
        <div id={contentId} className="p-4 border-t border-gray-200 bg-white">
          {children}
        </div>
      )}
    </section>
  );
}