import { useState, useRef, useEffect } from 'react';

/**
 * MemberSearchSelect Component
 * Accessible combobox allowing user to search members by full name or unique member code.
 * UI strings are localized in German; all source comments are in English.
 *
 * @param {Object} props - Component properties
 * @param {string} [props.label='Mitglied'] - Form field label text
 * @param {string} [props.id='member-search'] - HTML element id
 * @param {Array<Object>} [props.members=[]] - Available member records matching SQLAlchemy schema
 * @param {Object|null} [props.selectedMember=null] - Currently active member object passed from parent
 * @param {Function} props.onSelect - Callback fired when a member is chosen or cleared
 * @param {boolean} [props.required=false] - Specifies if selection is mandatory
 * @param {string} [props.placeholder='Mitglied nach Namen suchen...'] - Input placeholder guidance text
 */
export default function MemberSearchSelect({
  label = 'Mitglied',
  id = 'member-search',
  members = [],
  selectedMember = null,
  onSelect,
  required = false,
  placeholder = 'Mitglied nach Namen suchen...',
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Display value: Prioritizes selected member object, otherwise shows active query text
  const displayValue = selectedMember
    ? `${selectedMember.vorname} ${selectedMember.nachname}`
    : query;

  // Filter members matching query across first name, last name, and member code
  const filteredMembers = members.filter((m) => {
    // When a member is already chosen, show all options on focus; otherwise filter by query
    const term = (selectedMember ? '' : query).toLowerCase().trim();
    if (!term) return true;

    const fullName = `${m.vorname} ${m.nachname}`.toLowerCase();
    const code = (m.mitgliedscode || '').toLowerCase();
    return fullName.includes(term) || code.includes(term);
  });

  function handleSelect(member) {
    onSelect(member);
    setQuery('');
    setIsOpen(false);
  }

  function handleInputChange(e) {
    const val = e.target.value;
    setQuery(val);
    setIsOpen(true);
    // If user edits text while a member was active, clear previous selection
    if (selectedMember) {
      onSelect(null);
    }
  }

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1 w-full">
      <label htmlFor={id} className="text-sm font-semibold text-gray-800">
        {label} {required && <span className="text-red-500 font-bold" aria-hidden="true">*</span>}
      </label>

      <div className="relative">
        <input
          id={id}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          required={required && !selectedMember}
          autoComplete="off"
          className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 bg-white shadow-xs focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none pr-8"
        />
        <span className="absolute right-3 top-3 text-xs text-gray-400 pointer-events-none">
          ▼
        </span>
      </div>

      {isOpen && filteredMembers.length > 0 && (
        <ul
          role="listbox"
          aria-label="Mitgliederliste"
          className="absolute top-full left-0 mt-1 w-full z-30 border border-gray-200 rounded-md shadow-lg bg-white max-h-60 overflow-y-auto"
        >
          {filteredMembers.map((m) => (
            <li
              key={m.mitglied_id}
              role="option"
              aria-selected={selectedMember?.mitglied_id === m.mitglied_id}
              onClick={() => handleSelect(m)}
              className="p-3 hover:bg-gray-100 cursor-pointer flex justify-between items-center border-b border-gray-100 last:border-b-0"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 text-sm">
                  {m.vorname} {m.nachname}
                </span>
                {m.mitgliedscode && (
                  <span className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                    {m.mitgliedscode}
                  </span>
                )}
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800 uppercase">
                {m.mitgliedsstatus || 'MO'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {isOpen && !selectedMember && query.trim() !== '' && filteredMembers.length === 0 && (
        <div className="absolute top-full left-0 mt-1 w-full z-30 border border-gray-200 rounded-md shadow-lg bg-white p-3 text-xs text-gray-500 text-center">
          Keine passenden Mitglieder gefunden
        </div>
      )}
    </div>
  );
}