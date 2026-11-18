import { useState, useRef, useEffect } from "react";
import InputField from "../components/InputField";
import MemberSearchSelect from "../components/MemberSearchSelect";
import SelectDropdown from "../components/SelectDropdown";
import TextareaField from "../components/TextareaField";
import FormButton from "../components/FormButton";
import ConfirmationCard from "../components/ConfirmationCard";
import { CalendarPopover } from "../components/DatePicker";
import { createPhoneCall } from "../services/api";
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

// Standardized call reason categories (1-5) matching backend topic_code
const CALL_REASONS = [
  { value: "1", label: "1 · Schichtanmeldung" },
  { value: "2", label: "2 · Clubhaus-Angelegenheiten" },
  { value: "3", label: "3 · Beratungsgespräch" },
  { value: "4", label: "4 · Krisenintervention" },
  { value: "5", label: "5 · Begleitgespräch" },
];

// Caller identity options matching backend person_type enum
const CALLER_OPTIONS = [
  { value: "member", label: "Mitglied" },
  { value: "staff", label: "Mitarbeiter" },
];

/**
 * PhoneLogPage Component
 * Form for logging phone calls, connected to central MemberContext and FastAPI backend.
 *
 * @param {Object} props
 * @param {Function} props.onBackToHome - Navigation callback returning to the dashboard
 */
export default function PhoneLogPage({ onBackToHome }) {
  // Consume cached active members and loading state from central context
  const { members, isLoading: isLoadingMembers } = useMembers();

  // --- Form Input States ---
  const [date, setDate] = useState(getPreviousBusinessDay);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [caller, setCaller] = useState("");
  const [duration, setDuration] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  // --- UI Feedback & Network States ---
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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
   * Validates mandatory form fields before opening the verification modal.
   *
   * @param {React.FormEvent} e - Form submit event
   */
  function handleFormSubmit(e) {
    e.preventDefault();

    if (!selectedMember) {
      setErrorMessage("Bitte wählen Sie ein Mitglied aus.");
      return;
    }
    if (!caller) {
      setErrorMessage("Bitte wählen Sie aus, wer telefoniert hat.");
      return;
    }
    if (!reason) {
      setErrorMessage("Bitte wählen Sie den Grund des Anrufs aus.");
      return;
    }

    setErrorMessage("");
    setShowConfirmation(true);
  }

  /**
   * Executes API persistence call to FastAPI endpoint POST /api/v1/phone-calls.
   * Clears caller-specific fields while keeping the selected date intact for batch entry.
   */
  async function handleFinalSave() {
    setShowConfirmation(false);
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      await createPhoneCall({
        person_id: selectedMember.member_id,
        person_type: caller,
        call_date: date,
        duration_minutes: duration,
        topic_code: reason,
        note: note,
      });

      setSaveSuccess(true);
      setSelectedMember(null);
      setDuration("");
      setReason("");
      setNote("");
      setCaller("");

      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err) {
      setErrorMessage(
        err.message || "Fehler beim Speichern der Telefondokumentation.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // Lookup German display labels for the verification summary
  const selectedReasonLabel =
    CALL_REASONS.find((r) => r.value === reason)?.label || "Nicht ausgewählt";
  const selectedCallerLabel =
    CALLER_OPTIONS.find((c) => c.value === caller)?.label || caller;

  // Key-value summary rows displayed inside ConfirmationCard
  const confirmationItems = [
    { label: "Datum", value: formatDisplayDate(date) },
    {
      label: "Mitglied",
      value: selectedMember
        ? `${selectedMember.first_name} ${selectedMember.last_name}`
        : "",
    },
    { label: "Wer telefoniert", value: selectedCallerLabel },
    { label: "Dauer (Minuten)", value: String(duration).padStart(2, "0") },
    { label: "Grund des Anrufs", value: selectedReasonLabel },
  ];

  return (
    <article aria-labelledby="phone-log-heading" className="app-card">
      {/* Dark Blue Header Bar (#05619A) */}
      <header className="app-card-header">
        <h2 id="phone-log-heading">Neuer Telefondoku-Eintrag</h2>
      </header>

      <div className="p-6 sm:p-8">
        {/* Success notification banner */}
        {saveSuccess && (
          <aside
            role="status"
            aria-live="polite"
            className="mb-4 p-3 bg-green-50 border border-[#0E8B06]/30 text-[#0E8B06] text-xs font-medium rounded-md"
          >
            ✓ Telefondokumentation erfolgreich gespeichert!
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

          {/* Semantic phone log entry form */}
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

            {/* Row 2: Caller identity and call duration */}
            <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-0 p-0 m-0">
              <legend className="sr-only">Anrufdetails</legend>

              <SelectDropdown
                id="who-is-calling"
                label="Wer telefoniert"
                placeholder="bitte wählen"
                value={caller}
                onChange={(e) => setCaller(e.target.value)}
                options={CALLER_OPTIONS}
                required
              />

              <InputField
                id="duration"
                label="Dauer (Minuten)"
                type="number"
                min="1"
                placeholder="z.B. 12"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                required
              />
            </fieldset>

            {/* Row 3: Call reason category (1-5) */}
            <SelectDropdown
              id="call-reason"
              label="Grund des Anrufs"
              placeholder="Grund auswählen"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              options={CALL_REASONS}
              required
            />

            {/* Row 4: Optional notes textarea */}
            <TextareaField
              id="note"
              label="Anmerkung"
              placeholder="Bei Bedarf eine Anmerkung hinzufügen (max. 500 Zeichen)"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

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
