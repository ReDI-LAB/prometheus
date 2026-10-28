import { useState, useEffect } from "react";
import InputField from "../components/InputField";
import MemberSearchSelect from "../components/MemberSearchSelect";
import FormButton from "../components/FormButton";
import ConfirmationCard from "../components/ConfirmationCard";
import { createAttendance, fetchMembers } from "../services/api";

// Helper: Calculate previous business day (Mon-Fri) synchronously
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
 *   Invalid / equal   => "0 Std."
 *
 * @param {string} arrival - "HH:MM"
 * @param {string} departure - "HH:MM"
 * @returns {string} Formatted duration string
 */
function calculateDuration(arrival, departure) {
  if (!arrival || !departure) return "0 Std.";

  const [aH, aM] = arrival.split(":").map(Number);
  const [dH, dM] = departure.split(":").map(Number);

  const diffMinutes = dH * 60 + dM - (aH * 60 + aM);

  if (diffMinutes <= 0) return "0 Std.";

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

export default function BabPage({ onBackToHome }) {
  // --- Form Input States ---
  const [date, setDate] = useState(getPreviousBusinessDay);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [arrival, setArrival] = useState("09:00");
  const [departure, setDeparture] = useState("14:00");
  const [note, setNote] = useState("");

  // Live member state fetched from FastAPI backend
  const [members, setMembers] = useState([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);

  // Tracks selected member from MemberSearchSelect
  const [selectedMember, setSelectedMember] = useState(null);

  // Derived state: Live total duration calculation
  const totalHours = calculateDuration(arrival, departure);

  // Status badge derived from selected member or default placeholder
  const statusBadge = selectedMember?.mitgliedsstatus
    ? selectedMember.mitgliedsstatus.toUpperCase()
    : "MO";
  const attendanceMonthly = "9 / Monat"; // Placeholder attendance counter

  // --- Modal & Feedback States ---
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch live members on component mount
  useEffect(() => {
    fetchMembers()
      .then((data) => {
        // Falls data ein Array ist direkt nehmen, sonst data.items auslesen:
        const memberList = Array.isArray(data) ? data : data.items || [];
        setMembers(memberList);
        setIsLoadingMembers(false);
      })
      .catch((err) => {
        console.error("Failed to load members:", err);
        setIsLoadingMembers(false);
      });
  }, []);

  // Format date display for German locale (e.g., "Montag, 01.09.2026")
  function formatDisplayDate(dateString) {
    if (!dateString) return "";
    const d = new Date(dateString);
    const options = {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    };
    return d.toLocaleDateString("de-DE", options);
  }

  // Intercept submit event to validate and open verification modal
  function handleFormSubmit(e) {
    e.preventDefault();

    if (!selectedMember) {
      alert("Bitte wählen Sie ein Mitglied aus.");
      return;
    }

    // Departure must be chronologically after arrival
    if (arrival && departure && departure <= arrival) {
      alert("Die Abgangszeit muss nach der Ankunftszeit liegen.");
      return;
    }

    setShowConfirmation(true);
  }

  // Execute persistence call to FastAPI backend
  async function handleFinalSave() {
    setShowConfirmation(false);
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      // Handles both backend UUID schema (member_id) and legacy mock schema (mitglied_id)
      const memberId = selectedMember.member_id || selectedMember.mitglied_id;

      await createAttendance({
        member_id: memberId,
        attendance_date: date,
        time_in: arrival,
        time_out: departure || null,
      });

      setSaveSuccess(true);
      // Reset member-specific fields for continuous batch entry
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

  // Member display name helper supporting both camelCase and snake_case models
  const memberDisplayName = selectedMember
    ? `${selectedMember.first_name || selectedMember.vorname || ""} ${selectedMember.last_name || selectedMember.nachname || ""}`.trim()
    : "Kein Mitglied ausgewählt";

  // Prepare key-value items for the confirmation card
  const confirmationItems = [
    { label: "Datum", value: formatDisplayDate(date) },
    {
      label: "Name des Mitglieds",
      value: memberDisplayName,
    },
    {
      label: "Zeiten / Gesamtdauer",
      value: `${arrival} – ${departure} (${totalHours})`,
    },
    {
      label: "Status / Anwesenheit",
      value: `${statusBadge} · ${attendanceMonthly}`,
    },
  ];

  return (
    <article
      aria-labelledby="bab-form-heading"
      className="max-w-4xl mx-auto bg-white rounded-2xl shadow-md border border-gray-200 p-8"
    >
      <header className="mb-4">
        <h2 id="bab-form-heading" className="text-lg font-bold text-gray-900">
          Neuer Anwesenheitseintrag
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          Erfassung von Kommen, Gehen und automatischer Stundenberechnung
        </p>
      </header>

      {/* Success banner */}
      {saveSuccess && (
        <aside
          role="status"
          aria-live="polite"
          className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 text-xs rounded-md"
        >
          ✓ Anwesenheit erfolgreich im Backend gespeichert!
        </aside>
      )}

      {/* Error banner */}
      {errorMessage && (
        <aside
          role="alert"
          aria-live="assertive"
          className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-md flex justify-between items-center"
        >
          <span>✕ {errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage("")}
            className="text-red-700 hover:text-red-900 font-bold ml-2 cursor-pointer"
            aria-label="Fehlermeldung schließen"
          >
            ✕
          </button>
        </aside>
      )}

      {/* Date row with semantic section and accessible edit button */}
      <section
        aria-label="Datumsangabe"
        className="mb-5 pb-3 border-b border-gray-100"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">
            {formatDisplayDate(date)}
          </span>
          <button
            type="button"
            onClick={() => setIsEditingDate(!isEditingDate)}
            className="text-gray-500 hover:text-gray-800 cursor-pointer text-xs"
            title="Datum ändern"
            aria-label="Datum manuell anpassen"
          >
            ✏️
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mt-0.5">
          Vorausgefüllt mit dem letzten Werktag
        </p>

        {isEditingDate && (
          <div className="mt-2">
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setIsEditingDate(false);
              }}
              className="text-xs border border-gray-300 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </section>

      {/* Semantic Form */}
      <form onSubmit={handleFormSubmit} className="space-y-4">
        {/* Row 1: Searchable Member Selection */}
        <MemberSearchSelect
          id="member-search"
          label="Mitglied"
          members={members}
          selectedMember={selectedMember}
          onSelect={(member) => setSelectedMember(member)}
          placeholder={
            isLoadingMembers
              ? "Lade Mitglieder aus Datenbank..."
              : "Mitglied nach Namen suchen..."
          }
          required
        />

        {/* Row 2: Arrival & Departure grouped in a fieldset */}
        <fieldset className="grid grid-cols-2 gap-3 border-0 p-0 mb-4">
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
            className="text-xs text-red-600 font-medium -mt-2 mb-3"
            role="alert"
          >
            Hinweis: Die Abgangszeit muss nach der Ankunftszeit liegen.
          </p>
        )}

        {/* Row 3: Semantic Output for calculated hours and metadata */}
        <dl className="space-y-1.5 pt-1 text-sm" aria-live="polite">
          <div className="flex items-baseline gap-1 font-semibold text-gray-900">
            <dt>Gesamtdauer:</dt>
            <dd>
              <output htmlFor="arrival departure">{totalHours}</output>
            </dd>
          </div>

          <div className="flex items-baseline gap-1 text-gray-500">
            <dt>Status:</dt>
            <dd className="font-semibold text-gray-900">
              {statusBadge.charAt(0).toUpperCase() +
                statusBadge.slice(1).toLowerCase()}
            </dd>
          </div>

          <div className="flex items-baseline gap-1 text-gray-500">
            <dt>Anwesenheiten:</dt>
            <dd className="font-semibold text-gray-900">{attendanceMonthly}</dd>
          </div>
        </dl>

        {/* Row 4: Optional notes */}
        <div className="flex flex-col gap-1 w-full mt-4">
          <label
            htmlFor="bab-note"
            className="text-sm font-semibold text-gray-800"
          >
            Anmerkung
          </label>
          <textarea
            id="bab-note"
            name="note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Bei Bedarf eine Anmerkung hinzufügen"
            aria-describedby="bab-note-hint"
            className="w-full rounded-md border border-gray-300 p-2.5 text-sm text-gray-900 placeholder-gray-400 bg-white
              focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <span id="bab-note-hint" className="sr-only">
            Optionales Freitextfeld für Anmerkungen zur Anwesenheit
          </span>
        </div>

        {/* Row 5: Action buttons */}
        <div className="flex justify-between items-center pt-3">
          <FormButton type="button" variant="secondary" onClick={onBackToHome}>
            Abbrechen
          </FormButton>
          <FormButton type="submit" variant="dark" disabled={isSubmitting}>
            {isSubmitting ? "Wird gespeichert..." : "Speichern"}
          </FormButton>
        </div>
      </form>

      {/* Confirmation Modal */}
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
