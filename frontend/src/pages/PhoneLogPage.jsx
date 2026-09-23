import { useState } from "react";
import InputField from "../components/InputField";
import MemberSearchSelect from "../components/MemberSearchSelect";
import SelectDropdown from "../components/SelectDropdown";
import TextareaField from "../components/TextareaField";
import FormButton from "../components/FormButton";
import ConfirmationCard from "../components/ConfirmationCard";

// Helper: Pre-fill with previous business day (Mon-Fri) synchronously
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

// 5 fixed reason categories defined in Clubhaus project requirements
const CALL_REASONS = [
  { value: "1", label: "1 · Anmeldung zu Schicht" },
  { value: "2", label: "2 · Clubhausbelange" },
  { value: "3", label: "3 · Beratungsgespräch" },
  { value: "4", label: "4 · Krisenintervention" },
  { value: "5", label: "5 · Entlastungsgespräch" },
];

// Caller options according to mockups (Staff vs. Member)
const CALLER_OPTIONS = [
  { value: "member", label: "Mitglied" },
  { value: "staff", label: "Mitarbeiter" },
];

export default function PhoneLogPage({ onBackToHome }) {
  // --- Form Input States ---
  const [date, setDate] = useState(getPreviousBusinessDay);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [caller, setCaller] = useState("member");
  const [duration, setDuration] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  // --- Modal & Feedback States ---
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Temporary mock data structured to match the backend SQLAlchemy model
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
    if (!reason) {
      alert("Bitte wählen Sie ein Anliegen aus.");
      return;
    }
    setShowConfirmation(true);
  }

  // Execute persistence feedback and navigate back
  function handleFinalSave() {
    setShowConfirmation(false);
    setSaveSuccess(true);

    // Reset caller-specific fields
    setSelectedMember(null);
    setDuration("");
    setReason("");
    setNote("");
    setCaller("member"); // Reset to default

    setTimeout(() => {
      setSaveSuccess(false);
    }, 3000);
  }

  // Selected label lookup for the confirmation card
  const selectedReasonLabel =
    CALL_REASONS.find((r) => r.value === reason)?.label || "Nicht ausgewählt";
  const selectedCallerLabel =
    CALLER_OPTIONS.find((c) => c.value === caller)?.label || caller;

  // Prepare key-value items for the confirmation card
  const confirmationItems = [
    { label: "Datum", value: formatDisplayDate(date) },
    {
      label: "Mitglied",
      value: selectedMember
        ? `${selectedMember.vorname} ${selectedMember.nachname} (${selectedMember.mitgliedscode})`
        : "",
    },
    { label: "Wer telefoniert", value: selectedCallerLabel },
    { label: "Dauer", value: `${duration} Minuten` },
    { label: "Anliegen", value: selectedReasonLabel },
  ];

  return (
    <article
      aria-labelledby="phone-log-heading"
      className="max-w-md mx-auto bg-white rounded-2xl shadow-md border border-gray-200 p-8"
    >
      <header className="mb-4">
        <h2 id="phone-log-heading" className="text-lg font-bold text-gray-900">
          Neuer Telefondoku-Eintrag
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          Manuelle Dokumentation von Anrufen (Kategorien 1–5)
        </p>
      </header>

      {saveSuccess && (
        <aside
          role="status"
          aria-live="polite"
          className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 text-xs rounded-md"
        >
          ✓ Telefondokumentation erfolgreich gespeichert!
        </aside>
      )}

      {/* Date row with edit toggle */}
      <section
        aria-label="Datumsangabe"
        className="mb-5 pb-3 border-b border-gray-100"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">
            Datum: {formatDisplayDate(date)}
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
          Mit dem letzten Werktag vorausgefüllt
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
          selectedMember={selectedMember} // <-- Diese Zeile ergänzen!
          onSelect={(member) => setSelectedMember(member)}
          placeholder="Mitglied nach Name oder Code suchen..."
          required
        />

        {/* Row 2: Caller and Duration side by side */}
        <fieldset className="grid grid-cols-2 gap-3 border-0 p-0 m-0">
          <legend className="sr-only">Anrufdetails</legend>

          <SelectDropdown
            id="who-is-calling"
            label="Wer telefoniert"
            value={caller}
            onChange={(e) => setCaller(e.target.value)}
            options={CALLER_OPTIONS}
            required
          />

          <InputField
            id="duration"
            label="Dauer (Min.)"
            type="number"
            min="1"
            placeholder="z. B. 12"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            required
          />
        </fieldset>

        {/* Row 3: Reason Dropdown (Categories 1-5) */}
        <SelectDropdown
          id="call-reason"
          label="Anliegen"
          placeholder="Bitte Anliegen wählen..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          options={CALL_REASONS}
          required
        />

        {/* Row 4: Optional Notes */}
        <TextareaField
          id="note"
          label="Notiz (optional)"
          placeholder="Notiz eingeben falls erforderlich..."
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {/* Row 5: Action Buttons */}
        <div className="flex justify-end gap-3 pt-3">
          <FormButton variant="secondary" onClick={onBackToHome}>
            Abbrechen
          </FormButton>
          <FormButton type="submit" variant="dark">
            Eintrag speichern
          </FormButton>
        </div>
      </form>

      {/* Verification Modal */}
      <ConfirmationCard
        isOpen={showConfirmation}
        title="Angaben überprüfen"
        items={confirmationItems}
        onCancel={() => setShowConfirmation(false)}
        onConfirm={handleFinalSave}
      />
    </article>
  );
}
