import { useState, useRef, useEffect } from 'react';

/**
 * MemberSearchSelect Component
 * Robust combobox with fail-safe array checks and smooth outside-click detection.
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

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper: Extract full display name supporting database and mock schemas
  function getFullName(m) {
    if (!m) return '';
    const first = m.first_name || m.vorname || '';
    const last = m.last_name || m.nachname || '';
    return `${first} ${last}`.trim();
  }

  // Helper: Extract unique member code
  function getMemberCode(m) {
    return m?.member_code || m?.mitgliedscode || '';
  }

  // Helper: Extract membership status badge
  function getMemberStatus(m) {
    return m?.membership_status || m?.mitgliedsstatus || 'MO';
  }

  // Helper: Extract member UUID
  function getMemberId(m) {
    return m?.member_id || m?.mitglied_id || '';
  }

  // Fail-safe: Ensure members is always an array, even if an object was passed
  const safeMembers = Array.isArray(members)
    ? members
    : (members && Array.isArray(members.items) ? members.items : []);

  // Filter members matching query
  const filteredMembers = safeMembers.filter((m) => {
    const term = (selectedMember ? '' : query).toLowerCase().trim();
    if (!term) return true;
    const fullName = getFullName(m).toLowerCase();
    const code = getMemberCode(m).toLowerCase();
    return fullName.includes(term) || code.includes(term);
  });

  // Display value in input field
  const displayValue = selectedMember ? getFullName(selectedMember) : query;

  function handleSelect(member) {
    if (onSelect) {
      onSelect(member);
    }
    setQuery('');
    setIsOpen(false);
  }

  function handleInputChange(e) {
    const val = e.target.value;
    setQuery(val);
    setIsOpen(true);
    if (selectedMember && onSelect) {
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
          className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 bg-white shadow-xs focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none pr-8 cursor-pointer"
        />
        <span className="absolute right-3 top-3 text-xs text-gray-400 pointer-events-none" aria-hidden="true">
          ▼
        </span>
      </div>

      {isOpen && filteredMembers.length > 0 && (
        <ul
          role="listbox"
          aria-label="Mitgliederliste"
          className="absolute top-full left-0 mt-1 w-full z-30 border border-gray-200 rounded-md shadow-lg bg-white max-h-60 overflow-y-auto"
        >
          {filteredMembers.map((m) => {
            const idVal = getMemberId(m);
            const name = getFullName(m);
            const code = getMemberCode(m);
            const status = getMemberStatus(m);

            return (
              <li
                key={idVal || name}
                role="option"
                aria-selected={getMemberId(selectedMember) === idVal}
                onClick={() => handleSelect(m)}
                className="p-3 hover:bg-teal-50 cursor-pointer flex justify-between items-center border-b border-gray-100 last:border-b-0 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 text-sm">
                    {name}
                  </span>
                  {code && (
                    <span className="text-xs font-mono bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded border border-gray-200">
                      {code}
                    </span>
                  )}
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800 uppercase">
                  {status}
                </span>
              </li>
            );
          })}
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
