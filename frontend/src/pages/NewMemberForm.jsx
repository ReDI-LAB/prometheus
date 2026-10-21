import { useState } from "react";
import InputField from "../components/InputField";
import BirthDatePicker from "../components/BirthDatePicker";
import RadioGroup from "../components/RadioGroup";
import Accordion from "../components/Accordion";
import StepProgress from "../components/StepProgress";
import FormButton from "../components/FormButton";
import ConfirmationCard from "../components/ConfirmationCard";

// Step definitions for the multi-step registration wizard
const STEPS = [
  { id: 1, label: "Persönliche Daten" },
  { id: 2, label: "Kontaktdaten" },
  { id: 3, label: "ClubHaus" },
];

const TITLE_OPTIONS = [
  { value: "", label: "Auswählen..." },
  { value: "Herr", label: "Herr" },
  { value: "Frau", label: "Frau" },
  { value: "Divers", label: "Divers" },
];

const GENDER_OPTIONS = [
  { value: "m", label: "Männlich" },
  { value: "w", label: "Weiblich" },
  { value: "d", label: "Divers" },
];

// Predefined staff list for the orientation interview dropdown
const STAFF_OPTIONS = [
  { value: "", label: "Mitarbeitenden auswählen..." },
  { value: "Mitarbeiter 1", label: "Mitarbeiter 1" },
  { value: "Mitarbeiter 2", label: "Mitarbeiter 2" },
  { value: "Mitarbeiter 3", label: "Mitarbeiter 3" },
];

// Initial blank form data template aligned with SQLAlchemy model
const INITIAL_FORM_DATA = {
  // Step 1: Personal Details
  anrede: "",
  vorname: "",
  nachname: "",
  geburtsdatum: "",
  geschlecht: "m",

  // Step 2: Contact Details
  strasse_hausnummer: "",
  postleitzahl: "",
  ort: "München",
  land: "Deutschland",
  sektor: "",
  mobile: "",
  telefon: "",
  email: "",

  // Emergency Contact (Accordion)
  notfall_name: "",
  notfall_beziehung: "",
  notfall_mobile: "",

  // Step 3: ClubHaus
  eintrittsdatum: new Date().toISOString().split("T")[0],
  ori_mitarbeiter: "",
  mitgliedsstatus: "mo",
  aktivitaetsstatus: "Aktiv",
};

// Maps Munich postal codes to operational sectors with outside-city fallback
function getSectorFromPlz(plz) {
  if (!plz || plz.length < 5) return "";

  // Non-Munich areas (e.g. Freising 85354)
  if (!plz.startsWith("80") && !plz.startsWith("81")) {
    return "Außerhalb";
  }

  const prefix = plz.substring(0, 3);
  if (["803", "807", "808", "809"].includes(prefix)) return "Nord";
  if (["813", "814", "815"].includes(prefix)) return "Süd";
  if (["816", "817", "818", "819"].includes(prefix)) return "Ost";
  if (["806", "812"].includes(prefix)) return "West";

  return "München (Unbekannt)";
}

export default function NewMemberPage({ onBackToHome }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);

  // Generic change handler updating form state and triggering PLZ sector calculation
  function handleChange(field, value) {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === "postleitzahl" && value.length === 5) {
        updated.sektor = getSectorFromPlz(value);
      }
      return updated;
    });
  }

  // Multi-step validation and forward progression
  function handleNextStep(e) {
    e.preventDefault();
    if (currentStep === 1) {
      if (
        !formData.vorname.trim() ||
        !formData.nachname.trim() ||
        !formData.geburtsdatum
      ) {
        alert(
          "Bitte füllen Sie alle Pflichtfelder (*) in den persönlichen Daten aus.",
        );
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (!formData.eintrittsdatum) {
        alert("Bitte geben Sie das Eintrittsdatum an.");
        return;
      }
      setShowConfirmation(true);
    }
  }

  function handlePrevStep() {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  }

  // Final submission: reset wizard to step 1 for continuous batch entry
  function handleFinalSave() {
    setShowConfirmation(false);
    setSaveSuccess(true);
    setCurrentStep(1);
    setFormData(INITIAL_FORM_DATA);

    setTimeout(() => {
      setSaveSuccess(false);
    }, 4000);
  }

  // Summary items for confirmation modal
  const confirmationItems = [
    {
      label: "Name",
      value: `${formData.anrede ? formData.anrede + " " : ""}${formData.vorname} ${formData.nachname}`,
    },
    { label: "Geburtsdatum", value: formData.geburtsdatum || "-" },
    {
      label: "Adresse",
      value: `${formData.strasse_hausnummer || "-"}, ${formData.postleitzahl} ${formData.ort}`,
    },
    { label: "Sektor", value: formData.sektor || "-" },
    {
      label: "Kontakt",
      value: formData.mobile || formData.telefon || formData.email || "-",
    },
    { label: "Eintrittsdatum", value: formData.eintrittsdatum },
    {
      label: "Orientierungsgespräch",
      value: formData.ori_mitarbeiter || "Nicht angegeben",
    },
  ];

  return (
    <article
      aria-labelledby="member-registration-heading"
      className="max-w-md mx-auto bg-white rounded-2xl shadow-md border border-gray-200 p-8"
    >
      <header className="mb-4">
        <h2
          id="member-registration-heading"
          className="text-lg font-bold text-gray-900"
        >
          Neues Mitglied anlegen
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          Erfassung der Mitglieder-Stammdaten (Schritt {currentStep} von 3)
        </p>
      </header>

      {/* Accessible step indicator */}
      <StepProgress steps={STEPS} currentStep={currentStep} />

      {saveSuccess && (
        <aside
          role="status"
          aria-live="polite"
          className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 text-xs rounded-md flex items-center justify-between"
        >
          <span>
            ✓ Mitglied erfolgreich registriert! Maske für nächste Eingabe
            bereit.
          </span>
          <button
            type="button"
            onClick={() => setSaveSuccess(false)}
            className="text-green-700 hover:text-green-900 font-bold ml-2 text-sm cursor-pointer"
            aria-label="Erfolgsmeldung schließen"
          >
            ✕
          </button>
        </aside>
      )}

      {/* Wizard Form */}
      <form onSubmit={handleNextStep} className="space-y-4">
        {/* ================= SCHRITT 1: PERSÖNLICHE DATEN ================= */}
        {currentStep === 1 && (
          <fieldset className="space-y-4 border-0 p-0 m-0">
            <legend className="w-full text-xs font-semibold uppercase tracking-wider text-gray-700 bg-gray-100 p-2 rounded-md mb-2">
              Persönliche Daten
            </legend>

            {/* 3-Column layout: Anrede, Vorname, Nachname */}
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="title"
                  className="text-sm font-semibold text-gray-800"
                >
                  Anrede
                </label>
                <select
                  id="title"
                  value={formData.anrede}
                  onChange={(e) => handleChange("anrede", e.target.value)}
                  className="h-10 w-full rounded-md border border-gray-300 px-2 text-sm bg-white shadow-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {TITLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <InputField
                id="first-name"
                label="Vorname"
                value={formData.vorname}
                onChange={(e) => handleChange("vorname", e.target.value)}
                placeholder="z. B. Max"
                required
              />

              <InputField
                id="last-name"
                label="Nachname"
                value={formData.nachname}
                onChange={(e) => handleChange("nachname", e.target.value)}
                placeholder="z. B. Mustermann"
                required
              />
            </div>

            {/* Birth Date Picker */}
            <BirthDatePicker
              label="Geburtsdatum"
              value={formData.geburtsdatum}
              onChange={(val) => handleChange("geburtsdatum", val)}
              required
            />

            {/* German Radio Group for Gender */}
            <RadioGroup
              label="Geschlecht"
              name="gender"
              value={formData.geschlecht}
              onChange={(e) => handleChange("geschlecht", e.target.value)}
              options={GENDER_OPTIONS}
            />
          </fieldset>
        )}

        {/* ================= SCHRITT 2: KONTAKTDATEN ================= */}
        {currentStep === 2 && (
          <fieldset className="space-y-4 border-0 p-0 m-0">
            <legend className="w-full text-xs font-semibold uppercase tracking-wider text-gray-700 bg-gray-100 p-2 rounded-md mb-2">
              Kontaktdaten
            </legend>

            <InputField
              id="street"
              label="Straße & Hausnummer"
              value={formData.strasse_hausnummer}
              onChange={(e) =>
                handleChange("strasse_hausnummer", e.target.value)
              }
              placeholder="z. B. Giesinger Str. 12"
            />

            <div className="grid grid-cols-2 gap-3">
              <InputField
                id="plz"
                label="Postleitzahl (PLZ)"
                value={formData.postleitzahl}
                onChange={(e) => handleChange("postleitzahl", e.target.value)}
                placeholder="z. B. 81539"
                maxLength={5}
              />
              <InputField
                id="city"
                label="Stadt / Ort"
                value={formData.ort}
                onChange={(e) => handleChange("ort", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <InputField
                id="country"
                label="Land"
                value={formData.land}
                onChange={(e) => handleChange("land", e.target.value)}
              />
              <InputField
                id="sector"
                label="Sektor"
                value={formData.sektor}
                onChange={(e) => handleChange("sektor", e.target.value)}
                placeholder="Automatisch aus PLZ"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="mobile"
                  className="text-sm font-semibold text-gray-800"
                >
                  Mobil
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-2.5 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-600 text-xs select-none">
                    🇩🇪 +49
                  </span>
                  <input
                    id="mobile"
                    type="tel"
                    value={formData.mobile}
                    onChange={(e) => handleChange("mobile", e.target.value)}
                    placeholder="170 1234567"
                    className="h-10 w-full rounded-r-md border border-gray-300 px-3 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <InputField
                id="phone"
                label="Telefon"
                type="tel"
                value={formData.telefon}
                onChange={(e) => handleChange("telefon", e.target.value)}
                placeholder="089 123456"
              />
            </div>

            <InputField
              id="email"
              label="E-Mail"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="name@beispiel.de"
            />

            {/* Collapsible Emergency Contact */}
            <Accordion title="Notfallkontakt">
              <div className="space-y-3 pt-2">
                <InputField
                  id="emergency-name"
                  label="Name der Kontaktperson"
                  value={formData.notfall_name}
                  onChange={(e) => handleChange("notfall_name", e.target.value)}
                  placeholder="z. B. Maria Mustermann"
                />
                <div className="grid grid-cols-2 gap-3">
                  <InputField
                    id="emergency-relation"
                    label="Beziehung"
                    value={formData.notfall_beziehung}
                    onChange={(e) =>
                      handleChange("notfall_beziehung", e.target.value)
                    }
                    placeholder="z. B. Mutter, Betreuer"
                  />
                  <InputField
                    id="emergency-phone"
                    label="Mobil"
                    type="tel"
                    value={formData.notfall_mobile}
                    onChange={(e) =>
                      handleChange("notfall_mobile", e.target.value)
                    }
                    placeholder="0151 9876543"
                  />
                </div>
              </div>
            </Accordion>
          </fieldset>
        )}

        {/* ================= SCHRITT 3: CLUBHAUS ================= */}
        {currentStep === 3 && (
          <fieldset className="space-y-4 border-0 p-0 m-0">
            <legend className="w-full text-xs font-semibold uppercase tracking-wider text-gray-700 bg-gray-100 p-2 rounded-md mb-2">
              ClubHaus
            </legend>

            <InputField
              id="enrolment-date"
              label="Eintrittsdatum"
              type="date"
              value={formData.eintrittsdatum}
              onChange={(e) => handleChange("eintrittsdatum", e.target.value)}
              required
            />

            <div className="flex flex-col gap-1">
              <label
                htmlFor="ori-interview"
                className="text-sm font-semibold text-gray-800"
              >
                Orientierungsgespräch geführt von
              </label>
              <select
                id="ori-interview"
                value={formData.ori_mitarbeiter}
                onChange={(e) =>
                  handleChange("ori_mitarbeiter", e.target.value)
                }
                className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm text-gray-900 bg-white shadow-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {STAFF_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </fieldset>
        )}

        {/* Bottom Navigation Buttons */}
        <div className="flex justify-between items-center pt-4 border-t border-gray-100">
          {currentStep > 1 ? (
            <FormButton
              type="button"
              variant="secondary"
              onClick={handlePrevStep}
            >
              &lt; Zurück
            </FormButton>
          ) : (
            <FormButton
              type="button"
              variant="secondary"
              onClick={onBackToHome}
            >
              Abbrechen
            </FormButton>
          )}

          <FormButton type="submit" variant="dark">
            {currentStep < 3 ? "Weiter >" : "Speichern"}
          </FormButton>
        </div>
      </form>

      {/* Confirmation Modal */}
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
