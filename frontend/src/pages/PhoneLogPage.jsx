import { useState } from "react";
import InputField from "../components/InputField";
import SelectDropdown from "../components/SelectDropdown";
import MemberSearchSelect from "../components/MemberSearchSelect";
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
  const day = today.getDay();
  let diff = 1;
  if (day === 1) diff = 3;
  if (day === 0) diff = 2;

  const lastWorkday = new Date(today);
  lastWorkday.setDate(today.getDate() - diff);
  return lastWorkday.toISOString().split("T")[0];
}

// Lookup options matching public.call_topics integer codes (1-5)
const CALL_REASONS = [
  { value: 1, label: "1. Schichtanmeldung" },
  { value: 2, label: "2. Clubhaus-Angelegenheiten" },
  { value: 3, label: "3. Beratungsgespräch" },
  { value: 4, label: "4. Krisenintervention" },
  { value: 5, label: "5. Begleitgespräch" },
];

// Lookup options matching public.caller_types codes ('member' | 'staff')
const CALLER_OPTIONS = [
  { value: "member", label: "Mitglied" },
  { value: "staff", label: "Mitarbeitende" },
];

/**
 * PhoneLogPage Component
 * Form for logging phone calls, connected to MemberContext and FastAPI backend.
 */
export default function PhoneLogPage() {
  const { members, isLoading: isLoadingMembers } = useMembers();

  // --- Form Input States ---
  const [date, setDate] = useState(getPreviousBusinessDay);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [caller, setCaller] = useState("");
  const [duration, setDuration] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  // Undo snapshot after clicking "Abbrechen"
  const [undoSnapshot, setUndoSnapshot] = useState(null);

  // --- UI Feedback & Submission States ---
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
   * Clears current inputs and stores a snapshot so the user can restore via "Rückgängig".
   */
  function handleClearWithUndo() {
    setUndoSnapshot({
      date,
      selectedMember,
      caller,
      duration,
      reason,
      note,
    });
    setSelectedMember(null);
    setCaller("");
    setDuration("");
    setReason("");
    setNote("");
    setErrorMessage("");
  }

  /**
   * Restores the form state captured before clicking "Abbrechen".
   */
  function handleUndoRestore() {
    if (!undoSnapshot) return;
    setDate(undoSnapshot.date);
    setSelectedMember(undoSnapshot.selectedMember);
    setCaller(undoSnapshot.caller);
    setDuration(undoSnapshot.duration);
    setReason(undoSnapshot.reason);
    setNote(undoSnapshot.note);
    setUndoSnapshot(null);
  }

  /**
   * Validates mandatory inputs and opens the verification modal before saving.
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

    if (!duration || Number(duration) <= 0) {
      setErrorMessage(
        "Bitte geben Sie eine gültige Dauer in Minuten ein (> 0).",
      );
      return;
    }

    if (!reason) {
      setErrorMessage("Bitte wählen Sie einen Grund für den Anruf aus.");
      return;
    }

    setErrorMessage("");
    setShowConfirmation(true);
  }

  /**
   * Submits phone call record to FastAPI endpoint POST /api/v1/phone-calls.
   * Clears person-specific fields while preserving the selected date for batch entry.
   */
  async function handleFinalSave() {
    setShowConfirmation(false);
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const personId = selectedMember.member_id || selectedMember.mitglied_id;

      await createPhoneCall({
        person_id: personId,
        person_type: caller,
        call_date: date,
        duration_minutes: Number(duration),
        topic_code: Number(reason),
        note,
      });

      setSaveSuccess(true);
      setUndoSnapshot(null);
      setSelectedMember(null);
      setCaller("");
      setDuration("");
      setReason("");
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

  const memberDisplayName = selectedMember
    ? `${selectedMember.first_name || selectedMember.vorname || ""} ${selectedMember.last_name || selectedMember.nachname || ""}`.trim()
    : "Kein Mitglied ausgewählt";

  const callerLabel =
    CALLER_OPTIONS.find((item) => item.value === caller)?.label || "-";

  const reasonLabel =
    CALL_REASONS.find(
      (item) => String(item.value) === String(reason),
    )?.label.replace(/^\d+\.\s*/, "") || "-";

  const confirmationItems = [
    { label: "Datum", value: formatDisplayDate(date) },
    { label: "Mitglied", value: memberDisplayName },
    { label: "Wer telefoniert", value: callerLabel },
    {
      label: "Dauer (Minuten)",
      value: duration ? String(duration).padStart(2, "0") : "-",
    },
    { label: "Grund des Anrufs", value: reasonLabel },
  ];

  return (
    <article aria-labelledby="phonelog-form-heading" className="app-card">
      {/* Dark Blue Header Bar (#05619A) */}
      <header className="app-card-header">
        <h2 id="phonelog-form-heading">Neuer Telefondoku-Eintrag</h2>
      </header>

      <div className="p-6 sm:p-8">
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
          {/* Date header section with calendar overlay trigger */}
          <section aria-label="Datumsangabe" className="mb-5">
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
              <CalendarPopover
                value={date}
                onCancel={() => setIsEditingDate(false)}
                onApply={(newIso) => {
                  setDate(newIso);
                  setIsEditingDate(false);
                }}
              />
            )}
          </section>

          <form onSubmit={handleFormSubmit} className="space-y-5">
            <MemberSearchSelect
              id="phonelog-member-search"
              label="Mitglied"
              members={members}
              selectedMember={selectedMember}
              onSelect={(member) => {
                setSelectedMember(member);
                setUndoSnapshot(null);
              }}
              placeholder={
                isLoadingMembers
                  ? "Lade Mitglieder..."
                  : "Mitglied nach Name suchen"
              }
              required
            />

            <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-0 p-0 m-0">
              <legend className="sr-only">Gesprächsdetails</legend>

              <SelectDropdown
                id="caller"
                label="Wer telefoniert"
                required
                value={caller}
                onChange={(e) => {
                  setCaller(e.target.value);
                  setUndoSnapshot(null);
                }}
                options={CALLER_OPTIONS}
                placeholder="bitte wählen"
              />

              <InputField
                id="duration"
                label="Dauer (Minuten)"
                type="number"
                min="1"
                max="480"
                required
                value={duration}
                onChange={(e) => {
                  setDuration(e.target.value);
                  setUndoSnapshot(null);
                }}
                placeholder="z.B. 12"
                onlyNumbers
              />
            </fieldset>

            <SelectDropdown
              id="reason"
              label="Grund des Anrufs"
              required
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setUndoSnapshot(null);
              }}
              options={CALL_REASONS}
              placeholder="Grund auswählen"
            />

            <div className="flex flex-col gap-1.5 w-full">
              <label
                htmlFor="phonelog-note"
                className="text-sm font-medium text-black"
              >
                Anmerkung
              </label>
              <textarea
                id="phonelog-note"
                name="note"
                rows={3}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Bei Bedarf eine Anmerkung hinzufügen (max. 500 Zeichen)"
                className="w-full rounded-md border border-gray-500 p-3 text-base text-black placeholder-[#B8BBBD] bg-white focus:border-[#0B84CF] focus:ring-2 focus:ring-[#0B84CF]/25 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-3">
              <FormButton
                type="button"
                variant="secondary"
                onClick={handleClearWithUndo}
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

        {/* Floating "Rückgängig" Pill Toast after clicking Abbrechen */}
        {undoSnapshot && (
          <div className="flex justify-center mt-5">
            <div
              role="status"
              aria-live="polite"
              className="inline-flex items-center gap-3 bg-white border border-gray-300 shadow-md rounded-md px-4 py-2 text-sm font-semibold text-black"
            >
              <button
                type="button"
                onClick={handleUndoRestore}
                className="hover:text-[#0B84CF] cursor-pointer"
              >
                Rückgängig
              </button>
              <button
                type="button"
                onClick={() => setUndoSnapshot(null)}
                aria-label="Hinweis schließen"
                className="text-gray-600 hover:text-black cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Figma Success Overlay Card */}
      {saveSuccess && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div
            role="status"
            aria-live="polite"
            className="bg-white rounded-xl shadow-xl px-10 py-8 text-center max-w-sm w-full"
          >
            <div className="w-12 h-12 rounded-full bg-[#0E8B06] text-white flex items-center justify-center mx-auto mb-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-6 h-6"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-[#0E8B06] mb-1">Super!</h3>
            <p className="text-sm text-black">Daten erfolgreich gespeichert.</p>
          </div>
        </div>
      )}

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
