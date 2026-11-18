import { useState, useRef, useEffect } from "react";

/**
 * MemberSearchSelect Component
 * Searchable member combobox matching Sahu's Figma Hi-Fi dropdown list.
 */
export default function MemberSearchSelect({
  label = "Mitglied",
  id = "member-search",
  members = [],
  selectedMember = null,
  onSelect,
  required = false,
  placeholder = "Mitglied nach Name suchen",
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

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
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function getFullName(m) {
    if (!m) return "";
    const first = m.first_name || m.vorname || "";
    const last = m.last_name || m.nachname || "";
    return `${first} ${last}`.trim();
  }

  function getMemberCode(m) {
    return m?.member_code || m?.mitgliedscode || "";
  }

  function getMemberId(m) {
    return m?.member_id || m?.mitglied_id || "";
  }

  const safeMembers = Array.isArray(members)
    ? members
    : members && Array.isArray(members.items)
      ? members.items
      : [];

  const filteredMembers = safeMembers.filter((m) => {
    const term = (selectedMember ? "" : query).toLowerCase().trim();
    if (!term) return true;
    const fullName = getFullName(m).toLowerCase();
    const code = getMemberCode(m).toLowerCase();
    return fullName.includes(term) || code.includes(term);
  });

  const displayValue = selectedMember ? getFullName(selectedMember) : query;

  function handleSelect(member) {
    onSelect?.(member);
    setQuery("");
    setIsOpen(false);
  }

  function handleInputChange(e) {
    const val = e.target.value;
    setQuery(val);
    setIsOpen(true);
    if (selectedMember) {
      onSelect?.(null);
    }
  }

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1.5 w-full">
      <label htmlFor={id} className="text-sm font-medium text-black">
        {label}
        {required && (
          <span className="text-[#B71D1D] font-bold ml-0.5" aria-hidden="true">
            *
          </span>
        )}
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
          className="h-11 w-full rounded-md border border-gray-500 px-3.5 py-2 pr-9 text-base text-black placeholder-[#B8BBBD] bg-white transition-colors focus:border-[#0B84CF] focus:ring-2 focus:ring-[#0B84CF]/25 focus:outline-none cursor-pointer"
        />
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className="w-4 h-4 text-black absolute right-3.5 top-3.5 pointer-events-none"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </div>

      {isOpen && filteredMembers.length > 0 && (
        <ul
          role="listbox"
          aria-label="Mitgliederliste"
          className="absolute top-full left-0 mt-1 w-full z-30 border border-gray-200 rounded-md shadow-lg bg-white max-h-56 overflow-y-auto divide-y divide-gray-200"
        >
          {filteredMembers.map((m) => {
            const idVal = getMemberId(m);
            const name = getFullName(m);
            const code = getMemberCode(m);

            return (
              <li
                key={idVal || name}
                role="option"
                aria-selected={getMemberId(selectedMember) === idVal}
                onClick={() => handleSelect(m)}
                className="px-4 py-3 hover:bg-[#EAF2FF] cursor-pointer flex items-center gap-3 text-sm text-black transition-colors"
              >
                <span className="font-medium">{name}</span>
                {code && (
                  <span className="text-xs font-mono text-[#5E5E5F] uppercase">
                    {code}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {isOpen &&
        !selectedMember &&
        query.trim() !== "" &&
        filteredMembers.length === 0 && (
          <div className="absolute top-full left-0 mt-1 w-full z-30 border border-gray-200 rounded-md shadow-lg bg-white p-3 text-xs text-[#5E5E5F] text-center">
            Keine passenden Mitglieder gefunden
          </div>
        )}
    </div>
  );
}
