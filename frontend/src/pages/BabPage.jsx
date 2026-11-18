import { useState, useRef, useEffect } from "react";
import InputField from "../components/InputField";
import MemberSearchSelect from "../components/MemberSearchSelect";
import FormButton from "../components/FormButton";
import ConfirmationCard from "../components/ConfirmationCard";
import { CalendarPopover } from "../components/DatePicker";
import { createAttendance } from "../services/api";
import { useMembers } from "../context/useMembers";

/**
 * Calculates previous business day (Monday through Friday) synchronously.
 *
 * @returns {string} Date formatted as YYYY-MM-DD
 */
function getPreviousBusinessDay() {
  const today = new Date();
  const day = today.getDay(); // 0 = Sunday, 1 = Monday
  let diff = 1;
  if (day === 1) diff = 3; // Monday -> Friday
  if (day === 0) diff = 2; // Sunday -> Friday

  const lastWorkday = new Date(today);
  lastWorkday.setDate(today.getDate() - diff);
  return lastWorkday.toISOString().split("T")[0];
}

/**
 * Calculates human-readable duration in hours and minutes.
 * Examples:
 *   "09:00" -> "14:30" => "5 Std. 30 Min."
 *   "09:00" -> "14:00" => "5 Std."
 *   "09:00" -> "09:45" => "45 Min."
 *   Invalid / equal   => "0 Std. 0 Min."
 *
 * @param {string} arrival - Arrival time formatted as "HH:MM"
 * @param {string} departure - Departure time formatted as "HH:MM"
 * @returns {string} Formatted duration string in German units
 */
function calculateDuration(arrival, departure) {
  if (!arrival || !departure) return "0 Std. 0 Min.";

  const [aH, aM] = arrival.split(":").map(Number);
  const [dH, dM] = departure.split(":").map(Number);

  const diffMinutes = dH * 60 + dM - (aH * 60 + aM);
  if (diffMinutes <= 0) return "0 Std. 0 Min.";

  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours} Std. ${minutes} Min.`;
  }
  if (hours > 0) {
    return `${hours} Std.`;
  }
  return `${minutes} Min.`;
}

/**
 * BabPage Component
 * Form for daily attendance logging (BAB), connected to central MemberContext.
 *
 * @param {Object} props
 * @param {Function} props.onBackToHome - Navigation callback returning to the dashboard
 */
export default function BabPage({ onBackToHome }) {
  // Consume cached active members and loading state from central context
  const { members, isLoading: isLoadingMembers } = useMembers();

  // --- Form Input States ---
  const [date, setDate] = useState(getPreviousBusinessDay);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [arrival, setArrival] = useState("09:00");
  const [departure, setDeparture] = useState("14:00");
  const [note, setNote] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);

  // --- UI Feedback & Submission States ---
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const datePopoverRef = useRef(null);

  // Close calendar popover when clicking outside the date section
  useEffect(() => {
    function handleOutside(e) {
      if (
        datePopoverRef.current &&
        !datePopoverRef.current.contains(e.target)
      ) {
        setIsEditingDate(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // Derived calculations: live duration, membership status, and monthly attendance count
  const totalHours = calculateDuration(arrival, departure);
  const statusBadge =
    selectedMember?.membership_status || selectedMember?.mitgliedsstatus
      ? (
          selectedMember.membership_status || selectedMember.mitgliedsstatus
        ).toUpperCase()
      : "MO";
  const attendanceMonthly = selectedMember ? "9 / Monat" : "0 / Monat";

  /**
   * Formats ISO date string into German localized date (e.g. "Montag, 07.09.2026").
   *
   * @param {string} dateString - ISO date formatted as "YYYY-MM-DD"
   * @returns {string} Localized German date string
   */
  function formatDisplayDate(dateString) {
    if (!dateString) return "";
    const d = new Date(dateString + "T12:00:00");
    return d.toLocaleDateString("de-DE", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  /**
   * Validates input fields and opens the verification modal before saving.
   *
   * @param {React.FormEvent} e - Form submit event
   */
  function handleFormSubmit(e) {
    e.preventDefault();

    if (!selectedMember) {
      setErrorMessage("Bitte wählen Sie ein Mitglied aus.");
      return;
    }

    // Departure time must strictly follow arrival time
    if (arrival && departure && departure <= arrival) {
      setErrorMessage("Die Abgangszeit muss nach der Ankunftszeit liegen.");
      return;
    }

    setErrorMessage("");
    setShowConfirmation(true);
  }

  /**
   * Executes API persistence call to FastAPI endpoint POST /api/v1/attendance.
   * Resets member-specific fields while preserving the selected date for batch entry.
   */
  async function handleFinalSave() {
    setShowConfirmation(false);
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      // Resolve both backend UUID schema (member_id) and legacy mock schema (mitglied_id)
      const memberId = selectedMember.member_id || selectedMember.mitglied_id;

      await createAttendance({
        member_id: memberId,
        attendance_date: date,
        time_in: arrival,
        time_out: departure || null,
      });

      setSaveSuccess(true);
      setSelectedMember(null);
      setNote("");

      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Resolve member display name across snake_case and legacy attributes
  const memberDisplayName = selectedMember
    ? `${selectedMember.first_name || selectedMember.vorname || ""} ${selectedMember.last_name || selectedMember.nachname || ""}`.trim()
    : "Kein Mitglied ausgewählt";

  // Key-value summary rows displayed inside ConfirmationCard
  const confirmationItems = [
    { label: "Datum", value: formatDisplayDate(date) },
    { label: "Mitglied", value: memberDisplayName },
    { label: "Uhrzeit", value: `${arrival} – ${departure}` },
    { label: "Gesamtstunden", value: totalHours },
    { label: "Status", value: statusBadge },
    { label: "Anwesenheit", value: attendanceMonthly },
  ];

  return (
    <article aria-labelledby="bab-form-heading" className="app-card">
      {/* Dark Blue Header Bar (#05619A) */}
      <header className="app-card-header">
        <h2 id="bab-form-heading">Neuer Anwesenheitseintrag</h2>
      </header>

      <div className="p-6 sm:p-8">
        {/* Success notification banner */}
        {saveSuccess && (
          <aside
            role="status"
            aria-live="polite"
            className="mb-4 p-3 bg-green-50 border border-[#0E8B06]/30 text-[#0E8B06] text-xs font-medium rounded-md"
          >
            ✓ Anwesenheit erfolgreich im Backend gespeichert!
          </aside>
        )}

        {/* Error notification banner */}
        {errorMessage && (
          <aside
            role="alert"
            aria-live="assertive"
            className="mb-4 p-3 bg-red-50 border border-[#B71D1D]/30 text-[#B71D1D] text-xs font-medium rounded-md flex justify-between items-center"
          >
            <span>✕ {errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage("")}
              className="text-[#B71D1D] font-bold ml-2 cursor-pointer"
              aria-label="Fehlermeldung schließen"
            >
              ✕
            </button>
          </aside>
        )}

        {/* Inner bordered form container */}
        <div className="app-form-box">
          {/* Date header section with interactive calendar popover */}
          <section
            ref={datePopoverRef}
            aria-label="Datumsangabe"
            className="relative mb-5"
          >
            <div className="flex items-center gap-2">
              <span className="text-base font-medium text-black">
                {formatDisplayDate(date)}
              </span>
              <button
                type="button"
                onClick={() => setIsEditingDate((prev) => !prev)}
                className="text-[#0B84CF] hover:text-[#05619A] cursor-pointer p-0.5"
                title="Datum ändern"
                aria-label="Datum manuell anpassen"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4"
                >
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-[#5E5E5F] mt-0.5">
              Vorausgefüllt mit dem letzten Arbeitstag
            </p>

            {isEditingDate && (
              <div className="absolute left-0 top-full mt-2 z-40">
                <CalendarPopover
                  value={date}
                  onCancel={() => setIsEditingDate(false)}
                  onApply={(newIso) => {
                    setDate(newIso);
                    setIsEditingDate(false);
                  }}
                />
              </div>
            )}
          </section>

          {/* Semantic attendance entry form */}
          <form onSubmit={handleFormSubmit} className="space-y-5">
            {/* Row 1: Searchable member combobox */}
            <MemberSearchSelect
              id="member-search"
              label="Mitglied"
              members={members}
              selectedMember={selectedMember}
              onSelect={(member) => setSelectedMember(member)}
              placeholder={
                isLoadingMembers
                  ? "Lade Mitglieder..."
                  : "Mitglied nach Name suchen"
              }
              required
            />

            {/* Row 2: Arrival and Departure grouped in a semantic fieldset */}
            <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-0 p-0 m-0">
              <legend className="sr-only">Anwesenheitszeiten</legend>

              <InputField
                id="arrival"
                label="Ankunft"
                type="time"
                required
                value={arrival}
                onChange={(e) => {
                  const newArrival = e.target.value;
                  setArrival(newArrival);
                  if (departure && departure <= newArrival) {
                    setDeparture("");
                  }
                }}
              />
              <InputField
                id="departure"
                label="Abgang"
                type="time"
                required
                value={departure}
                min={arrival}
                onChange={(e) => setDeparture(e.target.value)}
              />
            </fieldset>

            {arrival && departure && departure <= arrival && (
              <p
                className="text-xs text-[#B71D1D] font-medium -mt-2"
                role="alert"
              >
                Hinweis: Die Abgangszeit muss nach der Ankunftszeit liegen.
              </p>
            )}

            {/* Row 3: Live calculated hours, membership status, and monthly counter */}
            <dl className="space-y-2.5 pt-1 text-sm" aria-live="polite">
              <div className="flex items-baseline gap-1.5 text-[#5E5E5F]">
                <dt>Gesamtdauer:</dt>
                <dd className="font-semibold text-black">
                  <output htmlFor="arrival departure">{totalHours}</output>
                </dd>
              </div>

              <div className="flex items-center gap-1.5 text-[#5E5E5F]">
                <dt>Status:</dt>
                <dd className="font-semibold text-black inline-flex items-center gap-1.5">
                  <span>
                    {statusBadge.charAt(0).toUpperCase() +
                      statusBadge.slice(1).toLowerCase()}
                  </span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-3.5 h-3.5 text-[#0B84CF]"
                    aria-hidden="true"
                  >
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                  </svg>
                </dd>
              </div>

              <div className="flex items-baseline gap-1.5 text-[#5E5E5F]">
                <dt>Anwesenheiten:</dt>
                <dd className="font-semibold text-black">
                  {attendanceMonthly}
                </dd>
              </div>
            </dl>

            {/* Row 4: Optional notes textarea */}
            <div className="flex flex-col gap-1.5 w-full">
              <label
                htmlFor="bab-note"
                className="text-sm font-medium text-black"
              >
                Anmerkung
              </label>
              <textarea
                id="bab-note"
                name="note"
                rows={3}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Bei Bedarf eine Anmerkung hinzufügen (max. 500 Zeichen)"
                className="w-full rounded-md border border-gray-500 p-3 text-base text-black placeholder-[#B8BBBD] bg-white focus:border-[#0B84CF] focus:ring-2 focus:ring-[#0B84CF]/25 focus:outline-none"
              />
            </div>

            {/* Row 5: Primary and secondary action buttons */}
            <div className="grid grid-cols-2 gap-4 pt-3">
              <FormButton
                type="button"
                variant="secondary"
                onClick={onBackToHome}
                className="w-full"
              >
                Abbrechen
              </FormButton>
              <FormButton
                type="submit"
                variant="primary"
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? "Wird gespeichert..." : "Speichern"}
              </FormButton>
            </div>
          </form>
        </div>
      </div>

      {/* Verification modal dialog before final API persistence */}
      <ConfirmationCard
        isOpen={showConfirmation}
        title="Daten überprüfen"
        items={confirmationItems}
        onCancel={() => setShowConfirmation(false)}
        onConfirm={handleFinalSave}
      />
    </article>
  );
}
