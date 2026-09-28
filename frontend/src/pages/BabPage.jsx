import { useState } from "react";
import InputField from "../components/InputField";
import MemberSearchSelect from "../components/MemberSearchSelect";
import FormButton from "../components/FormButton";
import ConfirmationCard from "../components/ConfirmationCard";

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

// Helper: Calculate duration between arrival and departure times
function calculateDuration(arrival, departure) {
  if (!arrival || !departure) return "0.0";
  const [aH, aM] = arrival.split(":").map(Number);
  const [dH, dM] = departure.split(":").map(Number);
  const diffMinutes = dH * 60 + dM - (aH * 60 + aM);
  return diffMinutes > 0 ? (diffMinutes / 60).toFixed(1) : "0.0";
}

export default function BabPage({ onBackToHome }) {
  // --- Form Input States ---
  const [date, setDate] = useState(getPreviousBusinessDay);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [arrival, setArrival] = useState("09:00");
  const [departure, setDeparture] = useState("14:00");
  const [note, setNote] = useState("");

  // Tracks selected member from MemberSearchSelect
  const [selectedMember, setSelectedMember] = useState(null);

  // Derived state: Live total hours calculation
  const totalHours = calculateDuration(arrival, departure);

  // Status badge derived from selected member or default placeholder
  const statusBadge = selectedMember?.mitgliedsstatus
    ? selectedMember.mitgliedsstatus.toUpperCase()
    : "MO";
  const attendanceMonthly = "9 / Monat"; // Attendance count this month (placeholder)

  // --- Modal & Feedback States ---
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Mock member records matching the backend SQLAlchemy table structure
  const memberList = [
    {
      mitglied_id: "a1b2c3d4-0001-4000-8000-000000000001",
      mitgliedscode: "M-101",
      vorname: "Jane",
      nachname: "Doe",
      mitgliedsstatus: "mo",
    },
    {
      mitglied_id: "a1b2c3d4-0002-4000-8000-000000000002",
      mitgliedscode: "M-102",
      vorname: "Max",
      nachname: "Mustermann",
      mitgliedsstatus: "m",
    },
    {
      mitglied_id: "a1b2c3d4-0003-4000-8000-000000000003",
      mitgliedscode: "M-103",
      vorname: "Erika",
      nachname: "Musterfrau",
      mitgliedsstatus: "mo",
    },
  ];

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
    setShowConfirmation(true);
  }

  // Execute submission feedback, reset inputs, and stay on the form
  function handleFinalSave() {
    setShowConfirmation(false);
    setSaveSuccess(true);

    // Reset member-specific fields for the next entry
    setSelectedMember(null);
    setNote("");

    // Hide the green success badge after 3 seconds
    setTimeout(() => {
      setSaveSuccess(false);
    }, 3000);
  }

  // Prepare key-value items for the confirmation card
  const confirmationItems = [
    { label: "Datum", value: formatDisplayDate(date) },
    {
      label: "Name des Mitglieds",
      value: selectedMember
        ? `${selectedMember.vorname} ${selectedMember.nachname} (${selectedMember.mitgliedscode})`
        : "Kein Mitglied ausgewählt",
    },
    {
      label: "Zeiten / Gesamtstunden",
      value: `${arrival} – ${departure} (${totalHours} Std.)`,
    },
    {
      label: "Status / Anwesenheit",
      value: `${statusBadge} · ${attendanceMonthly}`,
    },
  ];

  return (
    <article
      aria-labelledby="bab-form-heading"
      className="max-w-md mx-auto bg-white rounded-2xl shadow-md border border-gray-200 p-8"
    >
      <header className="mb-4">
        <h2 id="bab-form-heading" className="text-lg font-bold text-gray-900">
          Neuer Anwesenheitseintrag
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          Erfassung von Kommen, Gehen und automatischer Stundenberechnung
        </p>
      </header>

      {saveSuccess && (
        <aside
          role="status"
          aria-live="polite"
          className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 text-xs rounded-md"
        >
          ✓ Anwesenheit erfolgreich gespeichert!
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
          members={memberList}
          selectedMember={selectedMember}
          onSelect={(member) => setSelectedMember(member)}
          placeholder="Mitglied nach Namen suchen..."
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
            onChange={(e) => setArrival(e.target.value)}
          />
          <InputField
            id="departure"
            label="Abgang"
            type="time"
            required
            value={departure}
            onChange={(e) => setDeparture(e.target.value)}
          />
        </fieldset>

        {/* Row 3: Semantic Output for calculated hours and metadata */}

        <dl className="space-y-1.5 pt-1 text-sm" aria-live="polite">
          {/* Zeile 1: Gesamtdauer */}
          <div className="flex items-baseline gap-1 font-semibold text-gray-900">
            <dt>Gesamtdauer:</dt>
            <dd>
              <output htmlFor="arrival departure">
                {Number(totalHours) > 0
                  ? `${totalHours.replace(".0", "")} Std.`
                  : "0 Std."}
              </output>
            </dd>
          </div>

          {/* Mitgliedsstatus */}
          <div className="flex items-baseline gap-1 text-gray-500">
            <dt>Status:</dt>
            <dd className="font-semibold text-gray-900">
              {statusBadge.charAt(0).toUpperCase() +
                statusBadge.slice(1).toLowerCase()}
            </dd>
          </div>

          {/* Monatszähler */}
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
        <div className="flex justify-end gap-3 pt-3">
          <FormButton variant="secondary" onClick={onBackToHome}>
            Abbrechen
          </FormButton>
          <FormButton type="submit" variant="dark">
            Speichern
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
