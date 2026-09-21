import { useState, useRef, useEffect } from 'react';

/**
 * MemberSearchSelect Component
 * Provides an accessible combobox / autocomplete field for selecting members.
 * Supports searching across full name (vorname, nachname) and unique member code.
 */
export default function MemberSearchSelect({
  label = 'Mitglied suchen',
  id = 'member-search',
  members = [], // Expects array of objects: { mitglied_id, vorname, nachname, mitgliedscode, mitgliedsstatus }
  onSelect,     // Callback function invoked with the selected member object
  required = false,
  placeholder = 'Name oder Code eingeben (z. B. M-101)...',
}) {
  // --- Component States ---
  // Tracks current text typed into the search input
  const [searchTerm, setSearchTerm] = useState('');
  // Controls visibility of the floating dropdown results list
  const [isOpen, setIsOpen] = useState(false);
  // Stores the actively selected member object or null if user edits query
  const [selectedMember, setSelectedMember] = useState(null);

  // --- DOM Reference (useRef) ---
  // Points directly to the outer container div in the browser DOM.
  // Used to detect whether a mouse click occurred inside or outside this component.
  const containerRef = useRef(null);

  // --- Click-Outside Handler (useEffect) ---
  // Closes the dropdown list when the user clicks anywhere outside the component boundary
  useEffect(() => {
    function handleClickOutside(event) {
      // If container exists and clicked element is not inside the container, close the list
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    // Attach global click listener on component mount
    document.addEventListener('mousedown', handleClickOutside);

    // Cleanup: remove global listener when component unmounts
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // --- Filtering Logic ---
  // Normalizes the search input and matches against vorname, nachname, and mitgliedscode
  const filteredMembers = members.filter((m) => {
    const term = searchTerm.toLowerCase().trim();
    // When input is blank, show all available members
    if (!term) return true;

    // Combine first and last name for full-name matching
    const fullName = `${m.vorname} ${m.nachname}`.toLowerCase();
    // Use fallback empty string to prevent crashes if mitgliedscode is null/undefined
    const code = (m.mitgliedscode || '').toLowerCase();

    // Logical OR: matches if search term is part of full name OR part of member code
    return fullName.includes(term) || code.includes(term);
  });

  // --- Event Handlers ---
  // Handles member selection when an item from the list is clicked
  function handleSelect(member) {
    setSelectedMember(member);
    // Display full name inside the text input
    setSearchTerm(`${member.vorname} ${member.nachname}`);
    // Close dropdown menu
    setIsOpen(false);

    // Notify parent component (e.g. BabForm) about the selected member
    if (onSelect) {
      onSelect(member);
    }
  }

  // Handles text change in the search input field
  function handleInputChange(e) {
    setSearchTerm(e.target.value);
    // Reset confirmed selection when user alters the search input manually
    setSelectedMember(null);
    // Reopen dropdown list while typing
    setIsOpen(true);
  }

  return (
    // containerRef attaches the DOM node reference to this root element
    <div ref={containerRef} className="relative flex flex-col gap-1 w-full">
      {/* Field Label */}
      <label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500 font-bold" aria-hidden="true">*</span>}
      </label>

      {/* Accessible Search Input Field */}
      <input
        id={id}
        type="text"
        value={searchTerm}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        required={required && !selectedMember}
        autoComplete="off"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white shadow-xs transition-colors
          focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
      />

      {/* Floating Results List (Rendered only when open and results exist) */}
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
              {/* Member identification area */}
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900 text-sm">
                  {m.vorname} {m.nachname}
                </span>

                {/* Member code badge to resolve same-name ambiguities */}
                {m.mitgliedscode && (
                  <span className="text-xs font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded border border-gray-200">
                    {m.mitgliedscode}
                  </span>
                )}
              </div>

              {/* Status badge: 'MO' or 'M' derived from SQLAlchemy model */}
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800 uppercase">
                {m.mitgliedsstatus || 'mo'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Empty State message when no member matches the query */}
      {isOpen && searchTerm.trim() !== '' && filteredMembers.length === 0 && (
        <div className="absolute top-full left-0 mt-1 w-full z-20 border border-gray-200 rounded-md shadow-lg bg-white p-3 text-xs text-gray-500 text-center">
          Keine passenden Mitglieder gefunden
        </div>
      )}
    </div>
  );
}