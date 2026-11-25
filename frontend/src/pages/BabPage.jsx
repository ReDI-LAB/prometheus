import { useState, useEffect } from "react";
import InputField from "../components/InputField";
import MemberSearchSelect from "../components/MemberSearchSelect";
import FormButton from "../components/FormButton";
import ConfirmationCard from "../components/ConfirmationCard";
import { CalendarPopover } from "../components/DatePicker";
import { createAttendance, fetchAttendanceSummary } from "../services/api";
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
 * Form for daily attendance logging (BAB), connected to MemberContext and attendance summary API.
 */
export default function BabPage() {
  const { members, isLoading: isLoadingMembers } = useMembers();

  // --- Form Input States ---
  const [date, setDate] = useState(getPreviousBusinessDay);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [arrival, setArrival] = useState("09:00");
  const [departure, setDeparture] = useState("14:00");
  const [note, setNote] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);
  const [monthlyVisits, setMonthlyVisits] = useState(null);

  // Manual status override state (e.g. "Mo" or "M")
  const [statusOverride, setStatusOverride] = useState(null);
  const [isEditingStatus, setIsEditingStatus] = useState(false);

  // Undo snapshot after clicking "Abbrechen"
  const [undoSnapshot, setUndoSnapshot] = useState(null);

  // --- UI Feedback & Submission States ---
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch real monthly visit counter whenever a member or month changes
  useEffect(() => {
    const memberId = selectedMember?.member_id || selectedMember?.mitglied_id;
    if (!memberId) return;

    let isMounted = true;
    const monthParam = date ? date.slice(0, 7) : null;

    fetchAttendanceSummary(memberId, monthParam)
      .then((summary) => {
        if (isMounted && typeof summary?.visits === "number") {
          setMonthlyVisits(summary.visits);
        }
      })
      .catch(() => {
        if (isMounted) {
          setMonthlyVisits(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedMember, date]);

  // Derived calculations: live duration, membership status (M vs. MO), and monthly counter
  const totalHours = calculateDuration(arrival, departure);

  const computedStatusBadge =
    typeof selectedMember?.is_member === "boolean"
      ? selectedMember.is_member
        ? "M"
        : "MO"
      : selectedMember?.membership_status || selectedMember?.mitgliedsstatus
        ? (
            selectedMember.membership_status || selectedMember.mitgliedsstatus
          ).toUpperCase()
        : "MO";

  const statusBadge =
    statusOverride !== null ? statusOverride : computedStatusBadge;

  const formattedStatusLabel =
    statusBadge.length === 1
      ? statusBadge.toUpperCase()
      : statusBadge.charAt(0).toUpperCase() +
        statusBadge.slice(1).toLowerCase();

  const attendanceMonthly =
    selectedMember && monthlyVisits !== null
      ? `${monthlyVisits} / Monat`
      : "0 / Monat";

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
      arrival,
      departure,
      note,
      selectedMember,
      monthlyVisits,
      statusOverride,
    });
    setSelectedMember(null);
    setMonthlyVisits(null);
    setStatusOverride(null);
    setIsEditingStatus(false);
    setArrival("09:00");
    setDeparture("14:00");
    setNote("");
    setErrorMessage("");
  }

  /**
   * Restores the form state captured before clicking "Abbrechen".
   */
  function handleUndoRestore() {
    if (!undoSnapshot) return;
    setDate(undoSnapshot.date);
    setArrival(undoSnapshot.arrival);
    setDeparture(undoSnapshot.departure);
    setNote(undoSnapshot.note);
    setSelectedMember(undoSnapshot.selectedMember);
    setMonthlyVisits(undoSnapshot.monthlyVisits);
    setStatusOverride(undoSnapshot.statusOverride);
    setUndoSnapshot(null);
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
      const memberId = selectedMember.member_id || selectedMember.mitglied_id;

      await createAttendance({
        member_id: memberId,
        attendance_date: date,
        time_in: arrival,
        time_out: departure || null,
        note,
      });

      setSaveSuccess(true);
      setUndoSnapshot(null);
      setSelectedMember(null);
      setMonthlyVisits(null);
      setStatusOverride(null);
      setIsEditingStatus(false);
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

  const confirmationItems = [
    { label: "Datum", value: formatDisplayDate(date) },
    { label: "Mitglied", value: memberDisplayName },
    { label: "Uhrzeit", value: `${arrival} – ${departure}` },
    { label: "Gesamtstunden", value: totalHours },
    { label: "Status", value: statusBadge.toUpperCase() },
    { label: "Anwesenheit", value: attendanceMonthly },
  ];

  return (
    <article aria-labelledby="bab-form-heading" className="app-card">
      {/* Dark Blue Header Bar (#05619A) */}
      <header className="app-card-header">
        <h2 id="bab-form-heading">Neuer Anwesenheitseintrag</h2>
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
              id="member-search"
              label="Mitglied"
              members={members}
              selectedMember={selectedMember}
              onSelect={(member) => {
                setSelectedMember(member);
                setStatusOverride(null);
                setIsEditingStatus(false);
                setUndoSnapshot(null);
                if (!member) setMonthlyVisits(null);
              }}
              placeholder={
                isLoadingMembers
                  ? "Lade Mitglieder..."
                  : "Mitglied nach Name suchen"
              }
              required
            />

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

            <dl className="space-y-2.5 pt-1 text-sm" aria-live="polite">
              <div className="flex items-baseline gap-1.5 text-[#5E5E5F]">
                <dt>Gesamtdauer:</dt>
                <dd className="font-semibold text-black">
                  <output htmlFor="arrival departure">{totalHours}</output>
                </dd>
              </div>

              <div className="flex flex-col gap-1 text-[#5E5E5F]">
                <div className="flex items-center gap-1.5">
                  <dt>Status:</dt>
                  {!isEditingStatus && (
                    <dd className="font-semibold text-black inline-flex items-center gap-1.5">
                      <span>{formattedStatusLabel}</span>
                      <button
                        type="button"
                        onClick={() => setIsEditingStatus(true)}
                        className="text-[#0B84CF] hover:text-[#05619A] cursor-pointer p-0.5"
                        title="Status bearbeiten"
                        aria-label="Mitgliedsstatus bearbeiten"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="w-3.5 h-3.5"
                        >
                          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                        </svg>
                      </button>
                    </dd>
                  )}
                </div>

                {isEditingStatus && (
                  <div className="max-w-xs">
                    <input
                      type="text"
                      aria-label="Status eingeben (z. B. Mo oder M)"
                      value={statusOverride ?? formattedStatusLabel}
                      onChange={(e) => setStatusOverride(e.target.value)}
                      onBlur={() => setIsEditingStatus(false)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          setIsEditingStatus(false);
                        }
                      }}
                      autoFocus
                      maxLength={10}
                      className="h-9 w-full rounded-md border-2 border-[#0B84CF] px-3 text-sm font-semibold text-black bg-white focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-baseline gap-1.5 text-[#5E5E5F]">
                <dt>Anwesenheiten:</dt>
                <dd className="font-semibold text-black">
                  {attendanceMonthly}
                </dd>
              </div>
            </dl>

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
