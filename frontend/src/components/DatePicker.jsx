import { useState } from "react";

const MONTHS_DE = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

const WEEKDAYS_DE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/**
 * Converts an ISO date string (YYYY-MM-DD) into German display format (TT.MM.JJJJ).
 *
 * @param {string} isoDate - Date formatted as YYYY-MM-DD
 * @returns {string} Formatted German date string or empty string
 */
function formatIsoToGerman(isoDate) {
  if (!isoDate || !isoDate.includes("-")) return "";
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return "";
  return `${d}.${m}.${y}`;
}

/**
 * Reusable Calendar Modal/Popover matching Sahu's Figma Hi-Fi Calendar component.
 * Renders inside a centered viewport overlay so it is never clipped by card boundaries.
 *
 * @param {Object} props
 * @param {string} props.value - Currently selected ISO date (YYYY-MM-DD)
 * @param {Function} props.onApply - Callback fired with chosen ISO date when "Anwenden" is clicked
 * @param {Function} props.onCancel - Callback fired when "Abbrechen" is clicked
 */
export function CalendarPopover({ value, onApply, onCancel }) {
  const initialDate = value ? new Date(value + "T12:00:00") : new Date();
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [draftIso, setDraftIso] = useState(value || "");

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
  // Convert JS Sunday=0..Saturday=6 into Monday=0..Sunday=6
  const startOffset = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  /**
   * Navigates one month backward in the calendar grid.
   */
  function handlePrevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  /**
   * Navigates one month forward in the calendar grid.
   */
  function handleNextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  /**
   * Selects a specific day within the currently viewed month and year.
   *
   * @param {number} dayNum - Day of month (1..31)
   */
  function selectDay(dayNum) {
    const mStr = String(viewMonth + 1).padStart(2, "0");
    const dStr = String(dayNum).padStart(2, "0");
    setDraftIso(`${viewYear}-${mStr}-${dStr}`);
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-2xs flex items-center justify-center p-4 z-50"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Datum auswählen"
        onClick={(e) => e.stopPropagation()}
        className="w-80 bg-white rounded-xl shadow-2xl border border-gray-200 p-5 select-none"
      >
        {/* Month / Year Navigation Header */}
        <div className="flex items-center justify-between pb-3 mb-2 border-b border-gray-200">
          <button
            type="button"
            onClick={handlePrevMonth}
            aria-label="Vorheriger Monat"
            className="w-8 h-8 rounded-md border border-gray-200 flex items-center justify-center text-black hover:bg-gray-100 cursor-pointer"
          >
            ‹
          </button>

          <div className="flex items-center gap-1.5 text-base font-semibold text-black">
            <span>{MONTHS_DE[viewMonth]}</span>
            <select
              aria-label="Jahr auswählen"
              value={viewYear}
              onChange={(e) => setViewYear(Number(e.target.value))}
              className="bg-transparent font-semibold text-black cursor-pointer focus:outline-none"
            >
              {Array.from(
                { length: 110 },
                (_, i) => new Date().getFullYear() + 1 - i,
              ).map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            aria-label="Nächster Monat"
            className="w-8 h-8 rounded-md border border-gray-200 flex items-center justify-center text-black hover:bg-gray-100 cursor-pointer"
          >
            ›
          </button>
        </div>

        {/* Weekday Labels */}
        <div className="grid grid-cols-7 text-center text-xs font-semibold text-black mb-1.5">
          {WEEKDAYS_DE.map((wd) => (
            <span key={wd} className="py-1">
              {wd}
            </span>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1 text-center text-sm mb-4">
          {Array.from({ length: startOffset }).map((_, idx) => (
            <span key={`empty-${idx}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(
            (dayNum) => {
              const cellIso = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
              const isSelected = draftIso === cellIso;

              return (
                <button
                  key={dayNum}
                  type="button"
                  onClick={() => selectDay(dayNum)}
                  className={`h-8 w-8 mx-auto rounded-md flex items-center justify-center text-sm transition-colors cursor-pointer ${
                    isSelected
                      ? "border border-[#0B84CF] text-black font-semibold bg-[#EAF2FF]/60"
                      : "text-black hover:bg-gray-100"
                  }`}
                >
                  {dayNum}
                </button>
              );
            },
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2 px-3 rounded-lg border border-gray-300 bg-white text-sm font-medium text-black hover:bg-gray-50 cursor-pointer"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={() => draftIso && onApply(draftIso)}
            disabled={!draftIso}
            className="flex-1 py-2 px-3 rounded-lg bg-[#0B84CF] text-sm font-semibold text-white hover:bg-[#05619A] disabled:opacity-50 cursor-pointer shadow-xs"
          >
            Anwenden
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * BirthDatePicker Component
 * Text input formatted as TT.MM.JJJJ with an interactive calendar modal trigger.
 *
 * @param {Object} props
 * @param {string} props.label - Visible German field label
 * @param {string} props.value - ISO date string (YYYY-MM-DD)
 * @param {Function} props.onChange - Callback returning updated YYYY-MM-DD string
 * @param {boolean} props.required - Whether input is mandatory
 */
export default function BirthDatePicker({
  label = "Geburtsdatum",
  value = "",
  onChange,
  required = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  // Tracks intermediate manual typing only while the user is actively editing the text input
  const [draftText, setDraftText] = useState(null);

  const displayedText =
    draftText !== null ? draftText : formatIsoToGerman(value);

  /**
   * Parses manual TT.MM.JJJJ input and propagates valid ISO dates to parent state.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} e - Input change event
   */
  function handleManualTyping(e) {
    const raw = e.target.value;
    setDraftText(raw);

    const match = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (match) {
      const [, dd, mm, yyyy] = match;
      onChange?.(`${yyyy}-${mm}-${dd}`);
      setDraftText(null);
    } else if (raw === "") {
      onChange?.("");
      setDraftText(null);
    }
  }

  return (
    <div className="relative flex flex-col gap-1.5 w-full">
      <label className="text-sm font-medium text-black">
        {label}
        {required && (
          <span className="text-[#B71D1D] font-bold ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </label>

      <div className="relative">
        <input
          type="text"
          value={displayedText}
          onChange={handleManualTyping}
          onBlur={() => setDraftText(null)}
          placeholder="TT.MM.JJJJ"
          required={required}
          className="h-11 w-full rounded-md border border-gray-500 px-3.5 py-2 pr-10 text-base text-black placeholder-[#B8BBBD] bg-white transition-colors focus:border-[#0B84CF] focus:ring-2 focus:ring-[#0B84CF]/25 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Kalender öffnen"
          className="absolute right-3 top-2.5 text-[#0B84CF] hover:text-[#05619A] cursor-pointer p-0.5"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </button>
      </div>

      {isOpen && (
        <CalendarPopover
          value={value}
          onCancel={() => setIsOpen(false)}
          onApply={(newIso) => {
            setDraftText(null);
            onChange?.(newIso);
            setIsOpen(false);
          }}
        />
      )}
    </div>
  );
}
