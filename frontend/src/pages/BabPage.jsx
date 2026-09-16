import { useState } from 'react';
import InputField from '../components/InputField';
import SelectDropdown from '../components/SelectDropdown';
import TextareaField from '../components/TextareaField';
import FormButton from '../components/FormButton';
import ConfirmationCard from '../components/ConfirmationCard';

// Helper: Calculate previous business day (Mon-Fri) synchronously
function getPreviousBusinessDay() {
  const today = new Date();
  const day = today.getDay(); // 0 = Sunday, 1 = Monday
  let diff = 1;
  if (day === 1) diff = 3; // Monday -> Friday
  if (day === 0) diff = 2; // Sunday -> Friday

  const lastWorkday = new Date(today);
  lastWorkday.setDate(today.getDate() - diff);
  return lastWorkday.toISOString().split('T')[0];
}

// Helper: Calculate duration between arrival and departure times
function calculateDuration(arrival, departure) {
  if (!arrival || !departure) return '0.0';
  const [aH, aM] = arrival.split(':').map(Number);
  const [dH, dM] = departure.split(':').map(Number);
  const diffMinutes = (dH * 60 + dM) - (aH * 60 + aM);
  return diffMinutes > 0 ? (diffMinutes / 60).toFixed(1) : '0.0';
}

export default function BabPage({ onBackToHome }) {
  // --- Form Input States (initialized directly with computed default values) ---
  const [date, setDate] = useState(getPreviousBusinessDay);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [memberName, setMemberName] = useState('');
  const [arrival, setArrival] = useState('09:00');
  const [departure, setDeparture] = useState('14:00');
  const [note, setNote] = useState('');

  // Derived state: Calculated on every render without triggering extra re-renders
  const totalHours = calculateDuration(arrival, departure);

  // --- Automatic & Placeholder States (Database connection in progress) ---
  const statusBadge = 'MO'; // According to the 6-week rule
  const attendanceMonthly = '9 / 22'; // Attendance count this month

  // --- Modal & Feedback States ---
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Temporary mock data for active members dropdown
  const activeMembers = [
    { value: 'Jane Doe', label: 'Jane Doe' },
    { value: 'Max Mustermann', label: 'Max Mustermann' },
    { value: 'Erika Musterfrau', label: 'Erika Musterfrau' },
  ];

  // Format date for German locale display (e.g., "Montag, 01.09.2026")
  function formatDisplayDate(dateString) {
    if (!dateString) return '';
    const d = new Date(dateString);
    const options = { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' };
    return d.toLocaleDateString('de-DE', options);
  }

  // Intercept submit event to display verification modal first
  function handleFormSubmit(e) {
    e.preventDefault();
    setShowConfirmation(true);
  }

  // Execute actual submission after user confirms in the modal
  function handleFinalSave() {
    setShowConfirmation(false);
    setSaveSuccess(true);

    setTimeout(() => {
      setSaveSuccess(false);
      onBackToHome();
    }, 2500);
  }

  // Prepare key-value pairs passed to the confirmation component
  const confirmationItems = [
    { label: 'Datum', value: formatDisplayDate(date) },
    { label: 'Name des Mitglieds', value: memberName },
    { label: 'Zeiten / Gesamtstunden', value: `${arrival} – ${departure} (${totalHours} Std.)` },
    { label: 'Status / Anwesenheit', value: `${statusBadge} · ${attendanceMonthly}` },
  ];

  return (
    <div className="max-w-md mx-auto bg-white rounded-2xl shadow-md border border-gray-200 p-8">
      <h2 className="text-lg font-bold text-gray-900 mb-3">Tägliche BAB-Anwesenheit</h2>

      {saveSuccess && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 text-xs rounded-md" role="status">
          ✓ Anwesenheit erfolgreich gespeichert!
        </div>
      )}

      {/* Row 1: Date display with edit pencil icon */}
      <div className="mb-5 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">
            Datum: {formatDisplayDate(date)}
          </span>
          <button
            type="button"
            onClick={() => setIsEditingDate(!isEditingDate)}
            className="text-gray-500 hover:text-gray-800 cursor-pointer text-xs"
            title="Datum ändern"
          >
            ✏️
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mt-0.5">Mit dem letzten Werktag vorausgefüllt</p>

        {isEditingDate && (
          <div className="mt-2">
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setIsEditingDate(false);
              }}
              className="text-xs border border-gray-300 rounded px-2 py-1 outline-none"
            />
          </div>
        )}
      </div>

      <form onSubmit={handleFormSubmit} className="space-y-4">
        {/* Row 2: Member selection dropdown */}
        <SelectDropdown
          id="member-select"
          label="Name des Mitglieds"
          required
          placeholder="Mitglied nach Name suchen..."
          value={memberName}
          onChange={(e) => setMemberName(e.target.value)}
          options={activeMembers}
        />

        {/* Row 3: Arrival & Departure time inputs side-by-side */}
        <div className="grid grid-cols-2 gap-3">
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
        </div>

        {/* Row 4: Total hours calculation display */}
        <div className="text-xs font-bold text-gray-800 py-0.5">
          Gesamt: {Math.round(Number(totalHours))} Std.
        </div>

        {/* Row 5: Read-only auto badges */}
        <div className="grid grid-cols-2 gap-3">
          <InputField
            id="status"
            label="Status"
            value={statusBadge}
            readOnly
          />
          <InputField
            id="attendance"
            label="Anwesenheit"
            value={attendanceMonthly}
            readOnly
          />
        </div>

        {/* Row 6: Optional notes textarea */}
        <TextareaField
          id="note"
          label="Notiz (optional)"
          placeholder="Notiz eingeben falls erforderlich..."
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {/* Row 7: Action buttons */}
        <div className="flex justify-end gap-3 pt-3">
          <FormButton variant="secondary" onClick={onBackToHome}>
            Abbrechen
          </FormButton>
          <FormButton type="submit" variant="dark">
            Speichern
          </FormButton>
        </div>
      </form>

      {/* Confirmation modal */}
      <ConfirmationCard
        isOpen={showConfirmation}
        title="Angaben überprüfen"
        items={confirmationItems}
        onCancel={() => setShowConfirmation(false)}
        onConfirm={handleFinalSave}
      />
    </div>
  );
}