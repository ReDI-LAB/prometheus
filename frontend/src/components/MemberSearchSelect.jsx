import { useState, useRef, useEffect } from "react";

/**
 * MemberSearchSelect Component
 * Accessible combobox allowing user to search members by full name or unique member code.
 * UI strings are localized in German; all source comments are in English.
 *
 * @param {string} label - Form field label text
 * @param {string} id - HTML element id
 * @param {Array<Object>} members - Available member records matching SQLAlchemy schema
 * @param {Object|null} selectedMember - Currently active member object passed from parent
 * @param {Function} onSelect - Callback fired when a member is chosen or cleared
 * @param {boolean} required - Specifies if selection is mandatory
 * @param {string} placeholder - Input placeholder guidance text
 */
export default function MemberSearchSelect({
  label = "Mitglied suchen",
  id = "member-search",
  members = [],
  selectedMember = null,
  onSelect,
  required = false,
  placeholder = "Name oder Code (z. B. M-101)...",
}) {
  // Local input query state (tracks active typing)
  const [query, setQuery] = useState("");
  // Controls dropdown list popup visibility
  const [isOpen, setIsOpen] = useState(false);
  // DOM reference to detect clicks outside component boundaries
  const containerRef = useRef(null);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Compute displayed input value:
  // Shows selected member name if selected, otherwise shows what the user typed
  const inputValue = selectedMember
    ? `${selectedMember.vorname} ${selectedMember.nachname}`
    : query;

  // Filter members list based on query (by first name, last name, or member code)
  const filteredMembers = members.filter((m) => {
    const term = (selectedMember ? "" : query).toLowerCase().trim();
    if (!term) return true;

    const fullName = `${m.vorname} ${m.nachname}`.toLowerCase();
    const code = (m.mitgliedscode || "").toLowerCase();
    return fullName.includes(term) || code.includes(term);
  });

  // Handle member selection from results list
  function handleSelect(member) {
    setQuery("");
    setIsOpen(false);
    if (onSelect) {
      onSelect(member);
    }
  }

  // Handle user typing inside the search input
  function handleInputChange(e) {
    const nextValue = e.target.value;
    setQuery(nextValue);
    setIsOpen(true);

    // If an existing selection was modified, reset the parent state
    if (selectedMember && onSelect) {
      onSelect(null);
    }
  }

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1 w-full">
      {/* Semantic field label */}
      <label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label}{" "}
        {required && (
          <span className="text-red-500 font-bold" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {/* Accessible search input */}
      <input
        id={id}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        required={required && !selectedMember}
        autoComplete="off"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white shadow-xs transition-colors
          focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
      />

      {/* Floating results dropdown list */}
      {isOpen && filteredMembers.length > 0 && (
        <ul
          role="listbox"
          aria-label="Gefundene Mitglieder"
          className="absolute top-full left-0 mt-1 w-full z-20 border border-gray-200 rounded-md shadow-lg bg-white max-h-60 overflow-y-auto"
        >
          {filteredMembers.map((m) => (
            <li
              key={m.mitglied_id}
              role="option"
              aria-selected={selectedMember?.mitglied_id === m.mitglied_id}
              onClick={() => handleSelect(m)}
              className="p-3 hover:bg-teal-50 cursor-pointer flex justify-between items-center border-b border-gray-100 last:border-b-0 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900 text-sm">
                  {m.vorname} {m.nachname}
                </span>

                {/* Optional member code tag to avoid ambiguities with same names */}
                {m.mitgliedscode && (
                  <span className="text-xs font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded border border-gray-200">
                    {m.mitgliedscode}
                  </span>
                )}
              </div>

              {/* Status indicator badge (e.g. MO or M) */}
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800 uppercase">
                {m.mitgliedsstatus || "mo"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Empty search state feedback */}
      {isOpen && query.trim() !== "" && filteredMembers.length === 0 && (
        <div className="absolute top-full left-0 mt-1 w-full z-20 border border-gray-200 rounded-md shadow-lg bg-white p-3 text-xs text-gray-500 text-center">
          Keine passenden Mitglieder gefunden
        </div>
      )}
    </div>
  );
}
