import { useState } from "react";
import InputField from "../components/InputField";
import SelectDropdown from "../components/SelectDropdown";
import BirthDatePicker from "../components/BirthDatePicker";
import RadioGroup from "../components/RadioGroup";
import Accordion from "../components/Accordion";
import StepProgress from "../components/StepProgress";
import FormButton from "../components/FormButton";
import ConfirmationCard from "../components/ConfirmationCard";

// Step definition items for the multi-step navigation
const STEPS = [
  { id: 1, label: "Personal Details" },
  { id: 2, label: "Contact Details" },
  { id: 3, label: "ClubHaus" },
];

const TITLE_OPTIONS = [
  { value: "Herr", label: "Herr" },
  { value: "Frau", label: "Frau" },
  { value: "Divers", label: "Divers" },
];

const GENDER_OPTIONS = [
  { value: "m", label: "Male" },
  { value: "w", label: "Female" },
  { value: "d", label: "Other" },
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
  sektor: "",
  telefon: "",
  mobile: "",
  email: "",

  // Emergency Contact (Accordion)
  notfall_name: "",
  notfall_beziehung: "",
  notfall_telefon: "",

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

  // Generic change handler for standard inputs
  function handleChange(field, value) {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      // Derive sector when full 5-digit zip code is entered
      if (field === "postleitzahl" && value.length === 5) {
        updated.sektor = getSectorFromPlz(value);
      }
      return updated;
    });
  }

  // Multi-step validation and forward navigation
  function handleNextStep(e) {
    e.preventDefault();
    if (currentStep === 1) {
      if (!formData.vorname || !formData.nachname || !formData.geburtsdatum) {
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

  // Resets state to step 1 with empty inputs for rapid consecutive registrations
  function handleFinalSave() {
    setShowConfirmation(false);
    setSaveSuccess(true);

    // Reset wizard back to Step 1
    setCurrentStep(1);

    // Clear all fields back to blank template
    setFormData(INITIAL_FORM_DATA);

    // Automatically dismiss success banner after 4 seconds
    setTimeout(() => {
      setSaveSuccess(false);
    }, 4000);
  }

  // Summary items for verification dialog
  const confirmationItems = [
    {
      label: "Name",
      value: `${formData.anrede ? formData.anrede + " " : ""}${formData.vorname} ${formData.nachname}`,
    },
    { label: "Geburtsdatum", value: formData.geburtsdatum },
    {
      label: "Adresse",
      value: `${formData.strasse_hausnummer || "-"}, ${formData.postleitzahl} ${formData.ort}`,
    },
    { label: "Sektor", value: formData.sektor || "-" },
    {
      label: "Kontakt",
      value: formData.email || formData.mobile || formData.telefon || "-",
    },
    { label: "Eintrittsdatum", value: formData.eintrittsdatum },
    {
      label: "Status",
      value: `${formData.mitgliedsstatus.toUpperCase()} (${formData.aktivitaetsstatus})`,
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

      {/* Accessible Step Progress Indicator */}
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

      {/* Semantic Form Container */}
      <form onSubmit={handleNextStep} className="space-y-4">
        {/* ================= STEP 1: PERSONAL DETAILS ================= */}
        {currentStep === 1 && (
          <fieldset className="space-y-4 border-0 p-0 m-0">
            <legend className="w-full text-xs font-semibold uppercase tracking-wider text-gray-700 bg-gray-100 p-2 rounded-md mb-2">
              Personal Details
            </legend>

            <SelectDropdown
              id="title"
              label="Title / Anrede"
              value={formData.anrede}
              onChange={(e) => handleChange("anrede", e.target.value)}
              options={TITLE_OPTIONS}
            />

            <div className="grid grid-cols-2 gap-3">
              <InputField
                id="first-name"
                label="First Name"
                value={formData.vorname}
                onChange={(e) => handleChange("vorname", e.target.value)}
                placeholder="z. B. Max"
                required
              />
              <InputField
                id="last-name"
                label="Last Name"
                value={formData.nachname}
                onChange={(e) => handleChange("nachname", e.target.value)}
                placeholder="z. B. Mustermann"
                required
              />
            </div>

            {/* Accessible Birth Date Picker (Day / Month / Year Dropdowns) */}
            <BirthDatePicker
              label="Date of birth"
              value={formData.geburtsdatum}
              onChange={(val) => handleChange("geburtsdatum", val)}
              required
            />

            <RadioGroup
              label="Gender"
              name="gender"
              value={formData.geschlecht}
              onChange={(e) => handleChange("geschlecht", e.target.value)}
              options={GENDER_OPTIONS}
            />
          </fieldset>
        )}

        {/* ================= STEP 2: CONTACT DETAILS ================= */}
        {currentStep === 2 && (
          <fieldset className="space-y-4 border-0 p-0 m-0">
            <legend className="w-full text-xs font-semibold uppercase tracking-wider text-gray-700 bg-gray-100 p-2 rounded-md mb-2">
              Contact Details
            </legend>

            <InputField
              id="street"
              label="Street Name & Number"
              value={formData.strasse_hausnummer}
              onChange={(e) =>
                handleChange("strasse_hausnummer", e.target.value)
              }
              placeholder="z. B. Giesinger Str. 12"
            />

            <div className="grid grid-cols-2 gap-3">
              <InputField
                id="plz"
                label="Postal Code (PLZ)"
                value={formData.postleitzahl}
                onChange={(e) => handleChange("postleitzahl", e.target.value)}
                placeholder="z. B. 81539"
                maxLength={5}
              />
              <InputField
                id="city"
                label="City / Ort"
                value={formData.ort}
                onChange={(e) => handleChange("ort", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <InputField
                id="country"
                label="Country"
                value="Deutschland"
                readOnly
              />
              <InputField
                id="sector"
                label="Sector (Auto/Editierbar)"
                value={formData.sektor}
                onChange={(e) => handleChange("sektor", e.target.value)}
                placeholder="Automatisch aus PLZ"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <InputField
                id="mobile"
                label="Mobile (+49)"
                type="tel"
                value={formData.mobile}
                onChange={(e) => handleChange("mobile", e.target.value)}
                placeholder="0170 1234567"
              />
              <InputField
                id="phone"
                label="Phone (Festnetz)"
                type="tel"
                value={formData.telefon}
                onChange={(e) => handleChange("telefon", e.target.value)}
                placeholder="089 123456"
              />
            </div>

            <InputField
              id="email"
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="name@beispiel.de"
            />

            {/* Collapsible Emergency Contact Section */}
            <Accordion title="Emergency Contact (Notfallkontakt)">
              <div className="space-y-3">
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
                    label="Relation / Beziehung"
                    value={formData.notfall_beziehung}
                    onChange={(e) =>
                      handleChange("notfall_beziehung", e.target.value)
                    }
                    placeholder="Mutter, Betreuer, etc."
                  />
                  <InputField
                    id="emergency-phone"
                    label="Mobile (+49)"
                    type="tel"
                    value={formData.notfall_telefon}
                    onChange={(e) =>
                      handleChange("notfall_telefon", e.target.value)
                    }
                    placeholder="0151 9876543"
                  />
                </div>
              </div>
            </Accordion>
          </fieldset>
        )}

        {/* ================= STEP 3: CLUBHAUS ================= */}
        {currentStep === 3 && (
          <fieldset className="space-y-4 border-0 p-0 m-0">
            <legend className="w-full text-xs font-semibold uppercase tracking-wider text-gray-700 bg-gray-100 p-2 rounded-md mb-2">
              ClubHaus Data
            </legend>

            <InputField
              id="enrolment-date"
              label="Enrolment Date / Eintrittsdatum"
              type="date"
              value={formData.eintrittsdatum}
              onChange={(e) => handleChange("eintrittsdatum", e.target.value)}
              required
            />

            <InputField
              id="ori-interview"
              label="ORI Closing Interview Conducted By"
              value={formData.ori_mitarbeiter}
              onChange={(e) => handleChange("ori_mitarbeiter", e.target.value)}
              placeholder="Name des Mitarbeitenden..."
            />

            <div className="grid grid-cols-2 gap-3">
              <InputField
                id="membership-status"
                label="Mitgliedsstatus"
                value="MO (Standard)"
                readOnly
              />
              <InputField
                id="activity-status"
                label="Aktivitätsstatus"
                value="Aktiv (< 3 Monate)"
                readOnly
              />
            </div>
          </fieldset>
        )}

        {/* Navigation Action Buttons */}
        <div className="flex justify-between items-center pt-4 border-t border-gray-100">
          {currentStep > 1 ? (
            <FormButton
              type="button"
              variant="secondary"
              onClick={handlePrevStep}
            >
              &lt; Back
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
            {currentStep < 3 ? "Continue >" : "Mitglied speichern"}
          </FormButton>
        </div>
      </form>

      {/* Final Confirmation Verification Modal */}
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
