import { useState, useEffect } from 'react';
import InputField from '../components/InputField';
import MemberSearchSelect from '../components/MemberSearchSelect';
import SelectDropdown from '../components/SelectDropdown';
import TextareaField from '../components/TextareaField';
import FormButton from '../components/FormButton';
import ConfirmationCard from '../components/ConfirmationCard';
import { fetchMembers, createPhoneCall } from '../services/api';

/**
 * Calculates previous business day (Mon-Fri) synchronously.
 * @returns {string} YYYY-MM-DD
 */
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

// Standardized categories (1-5) matching backend topic_code
const CALL_REASONS = [
  { value: '1', label: '1 · Schichtanmeldung' },
  { value: '2', label: '2 · Clubhaus-Angelegenheiten' },
  { value: '3', label: '3 · Beratungsgespräch' },
  { value: '4', label: '4 · Krisenintervention' },
  { value: '5', label: '5 · Begleitgespräch' },
];

// Caller identity options
const CALLER_OPTIONS = [
  { value: 'member', label: 'Mitglied' },
  { value: 'staff', label: 'Mitarbeiter' },
];

export default function PhoneLogPage({ onBackToHome }) {
  // --- Form Input States ---
  const [date, setDate] = useState(getPreviousBusinessDay);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [members, setMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [caller, setCaller] = useState('member');
  const [duration, setDuration] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');

  // --- UI & Network Feedback States ---
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch live active members on mount
  useEffect(() => {
    let isMounted = true;

    async function loadMembers() {
      try {
        setIsLoadingMembers(true);
        const data = await fetchMembers();
        if (isMounted) {
          setMembers(data);
        }
      } catch (err) {
        if (isMounted) {
          setErrorMessage(err.message || 'Mitgliederliste konnte nicht geladen werden.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingMembers(false);
        }
      }
    }

    loadMembers();
    return () => {
      isMounted = false;
    };
  }, []);

  // Format date display for German locale (e.g. "Montag, 01.09.2026")
  function formatDisplayDate(dateString) {
    if (!dateString) return '';
    const d = new Date(dateString);
    return d.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  // Form submission: open confirmation card
  function handleFormSubmit(e) {
    e.preventDefault();
    if (!selectedMember) {
      alert('Bitte wählen Sie ein Mitglied aus.');
      return;
    }
    if (!reason) {
      alert('Bitte wählen Sie den Grund des Anrufs aus.');
      return;
    }
    setShowConfirmation(true);
  }

  // Final persistence call to FastAPI endpoint POST /api/v1/phone-calls
  async function handleFinalSave() {
    setShowConfirmation(false);
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      await createPhoneCall({
        person_id: selectedMember.member_id, // backend UUID identifier
        person_type: caller,
        call_date: date,
        duration_minutes: duration,
        topic_code: reason,
        note: note,
      });

      setSaveSuccess(true);

      // Reset member-specific fields for efficient batch entry, preserving date
      setSelectedMember(null);
      setDuration('');
      setReason('');
      setNote('');
      setCaller('member');

      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err) {
      setErrorMessage(err.message || 'Fehler beim Speichern der Telefondokumentation.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedReasonLabel =
    CALL_REASONS.find((r) => r.value === reason)?.label || 'Nicht ausgewählt';
  const selectedCallerLabel =
    CALLER_OPTIONS.find((c) => c.value === caller)?.label || caller;

  const confirmationItems = [
    { label: 'Datum', value: formatDisplayDate(date) },
    {
      label: 'Mitglied',
      value: selectedMember
        ? `${selectedMember.first_name} ${selectedMember.last_name} (${selectedMember.member_code})`
        : '',
    },
    { label: 'Wer telefoniert', value: selectedCallerLabel },
    { label: 'Dauer', value: `${duration} Minuten` },
    { label: 'Grund des Anrufs', value: selectedReasonLabel },
  ];

  return (
    <article
      aria-labelledby="phone-log-heading"
      className="max-w-4xl mx-auto bg-white rounded-2xl shadow-md border border-gray-200 p-8"
    >
      <header className="mb-4">
        <h2 id="phone-log-heading" className="text-lg font-bold text-gray-900">
          Neuer Telefondoku-Eintrag
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          Manuelle Dokumentation von Anrufen (Kategorien 1–5)
        </p>
      </header>

      {/* Success Notification */}
      {saveSuccess && (
        <aside
          role="status"
          aria-live="polite"
          className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 text-xs rounded-md"
        >
          ✓ Telefondokumentation erfolgreich gespeichert!
        </aside>
      )}

      {/* Error Notification */}
      {errorMessage && (
        <aside
          role="alert"
          aria-live="assertive"
          className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-md flex justify-between items-center"
        >
          <span>✕ {errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage('')}
            className="text-red-700 hover:text-red-900 font-bold ml-2 cursor-pointer"
            aria-label="Fehlermeldung schließen"
          >
            ✕
          </button>
        </aside>
      )}

      {/* Date Header with Edit Toggle */}
      <section aria-label="Datumsangabe" className="mb-5 pb-3 border-b border-gray-100">
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
        {/* Row 1: Searchable Member Combobox */}
        <MemberSearchSelect
          id="member-search"
          label="Mitglied"
          members={members}
          selectedMember={selectedMember}
          onSelect={(member) => setSelectedMember(member)}
          placeholder={isLoadingMembers ? 'Lade Mitglieder...' : 'Mitglied nach Name oder Code suchen...'}
          required
        />

        {/* Row 2: Caller and Duration */}
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

        {/* Row 3: Reason Categories */}
        <SelectDropdown
          id="call-reason"
          label="Grund des Anrufs"
          placeholder="Bitte Anliegen wählen..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          options={CALL_REASONS}
          required
        />

        {/* Row 4: Optional Freeform Note */}
        <TextareaField
          id="note"
          label="Notiz (optional)"
          placeholder="Notiz eingeben falls erforderlich..."
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {/* Row 5: Action Controls */}
        <div className="flex justify-end gap-3 pt-3">
          <FormButton variant="secondary" onClick={onBackToHome}>
            Abbrechen
          </FormButton>
          <FormButton type="submit" variant="dark" disabled={isSubmitting}>
            {isSubmitting ? 'Wird gespeichert...' : 'Eintrag speichern'}
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