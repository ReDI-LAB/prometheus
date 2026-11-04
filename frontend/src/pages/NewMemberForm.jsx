import { useState } from "react";
import InputField from "../components/InputField";
import BirthDatePicker from "../components/DatePicker";
import RadioGroup from "../components/RadioGroup";
import Accordion from "../components/Accordion";
import StepProgress from "../components/StepProgress";
import FormButton from "../components/FormButton";
import ConfirmationCard from "../components/ConfirmationCard";
//import { createMember } from "../services/api";

const STEPS = [
  { id: 1, label: "Persönliche Daten" },
  { id: 2, label: "Kontaktdaten" },
  { id: 3, label: "ClubHaus" },
];

// Kombiniertes Dropdown für Anrede & Titel
const SALUTATION_OPTIONS = [
  { value: "", label: "Auswählen..." },
  { value: "Herr", label: "Herr" },
  { value: "Frau", label: "Frau" },
  { value: "Divers", label: "Divers" },
  { value: "Dr.", label: "Dr." },
  { value: "Prof.", label: "Prof." },
  { value: "Prof. Dr.", label: "Prof. Dr." },
];

const GENDER_OPTIONS = [
  { value: "m", label: "Männlich" },
  { value: "w", label: "Weiblich" },
  { value: "d", label: "Divers" },
];

const STAFF_OPTIONS = [
  { value: "", label: "Mitarbeitenden auswählen..." },
  { value: "Mitarbeiter 1", label: "Mitarbeiter 1" },
  { value: "Mitarbeiter 2", label: "Mitarbeiter 2" },
  { value: "Mitarbeiter 3", label: "Mitarbeiter 3" },
];

const INITIAL_FORM_DATA = {
  // Step 1: Personal Details (anrede enthält Titel)
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

  // Emergency Contact
  notfall_name: "",
  notfall_beziehung: "",
  notfall_mobile: "",

  // Step 3: ClubHaus
  eintrittsdatum: new Date().toISOString().split("T")[0],
  ori_mitarbeiter: "",
  mitgliedsstatus: "mo",
  aktivitaetsstatus: "Aktiv",
};

function getSectorFromPlz(plz) {
  if (!plz || plz.length < 5) return "";

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

function isValidEmail(email) {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function NewMemberForm({ onBackToHome }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);

  const [isSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  function handleChange(field, value) {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === "postleitzahl" && value.length === 5) {
        updated.sektor = getSectorFromPlz(value);
      }
      return updated;
    });
  }

  function handleNextStep(e) {
    e.preventDefault();
    setErrorMessage("");

    if (currentStep === 1) {
      if (
        !formData.vorname.trim() ||
        !formData.nachname.trim() ||
        !formData.geburtsdatum
      ) {
        setErrorMessage(
          "Bitte füllen Sie alle Pflichtfelder (*) in den persönlichen Daten aus.",
        );
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (formData.email && !isValidEmail(formData.email)) {
        setErrorMessage(
          "Bitte geben Sie eine gültige E-Mail-Adresse ein (z. B. name@domain.de).",
        );
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (!formData.eintrittsdatum) {
        setErrorMessage("Bitte geben Sie das Eintrittsdatum an.");
        return;
      }
      setShowConfirmation(true);
    }
  }

  function handlePrevStep() {
    setErrorMessage("");
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  }

  // Handles final confirmation locally until backend POST /api/v1/members is delivered by Ai
  function handleFinalSave() {
    setShowConfirmation(false);
    setErrorMessage("");

    // Prepare complete payload matching database & schema requirements
    const memberPayload = {
      anrede: formData.anrede || null,
      first_name: formData.vorname.trim(),
      last_name: formData.nachname.trim(),
      date_of_birth: formData.geburtsdatum,
      gender: formData.geschlecht,
      street_house_number: formData.strasse_hausnummer || null,
      postal_code: formData.postleitzahl || null,
      city: formData.ort || null,
      country: formData.land || null,
      sector: formData.sektor || null,
      mobile_phone: formData.mobile ? `+49${formData.mobile}` : null,
      phone: formData.telefon || null,
      email: formData.email || null,
      emergency_contact_name: formData.notfall_name || null,
      emergency_contact_relation: formData.notfall_beziehung || null,
      emergency_contact_phone: formData.notfall_mobile || null,
      join_date: formData.eintrittsdatum,
      orientation_staff: formData.ori_mitarbeiter || null,
    };

    // Output payload for review in browser developer tools (F12 / Console)
    console.log("Ready for POST /api/v1/members:", memberPayload);

    // Provide immediate positive feedback and reset wizard for next entry
    setSaveSuccess(true);
    setCurrentStep(1);
    setFormData(INITIAL_FORM_DATA);

    setTimeout(() => {
      setSaveSuccess(false);
    }, 4000);
  }

  const confirmationItems = [
    {
      label: "Name",
      value:
        `${formData.anrede ? formData.anrede + " " : ""}${formData.vorname} ${formData.nachname}`.trim(),
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
      className="max-w-4xl mx-auto bg-white rounded-2xl shadow-md border border-gray-200 p-8"
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

      {errorMessage && (
        <aside
          role="alert"
          aria-live="assertive"
          className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-md flex items-center justify-between"
        >
          <span>✕ {errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage("")}
            className="text-red-700 hover:text-red-900 font-bold ml-2 text-sm cursor-pointer"
            aria-label="Fehlermeldung schließen"
          >
            ✕
          </button>
        </aside>
      )}

      <form onSubmit={handleNextStep} className="space-y-4">
        {/* Step 1: Personal Details */}
        {currentStep === 1 && (
          <fieldset className="space-y-4 border-0 p-0 m-0">
            <legend className="w-full text-xs font-semibold uppercase tracking-wider text-gray-700 bg-gray-100 p-2 rounded-md mb-2">
              Persönliche Daten
            </legend>

            {/* 3-Spalten-Layout: Anrede/Titel, Vorname, Nachname */}
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="salutation"
                  className="text-sm font-semibold text-gray-800"
                >
                  Anrede / Titel
                </label>
                <select
                  id="salutation"
                  value={formData.anrede}
                  onChange={(e) => handleChange("anrede", e.target.value)}
                  className="h-10 w-full rounded-md border border-gray-300 px-2 text-sm bg-white shadow-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {SALUTATION_OPTIONS.map((opt) => (
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
                onlyLetters
              />

              <InputField
                id="last-name"
                label="Nachname"
                value={formData.nachname}
                onChange={(e) => handleChange("nachname", e.target.value)}
                placeholder="z. B. Mustermann"
                required
                onlyLetters
              />
            </div>

            <BirthDatePicker
              label="Geburtsdatum"
              value={formData.geburtsdatum}
              onChange={(val) => handleChange("geburtsdatum", val)}
              required
            />

            <RadioGroup
              label="Geschlecht"
              name="gender"
              value={formData.geschlecht}
              onChange={(e) => handleChange("geschlecht", e.target.value)}
              options={GENDER_OPTIONS}
            />
          </fieldset>
        )}

        {/* Step 2: Contact Details */}
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
                onlyNumbers
              />
              <InputField
                id="city"
                label="Stadt / Ort"
                value={formData.ort}
                onChange={(e) => handleChange("ort", e.target.value)}
                onlyLetters
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <InputField
                id="country"
                label="Land"
                value={formData.land}
                onChange={(e) => handleChange("land", e.target.value)}
                onlyLetters
              />
              <InputField
                id="sector"
                label="Sektor"
                value={formData.sektor}
                onChange={(e) => handleChange("sektor", e.target.value)}
                placeholder="Automatisch aus PLZ"
                readOnly
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
                  <InputField
                    id="mobile"
                    type="tel"
                    value={formData.mobile}
                    onChange={(e) => handleChange("mobile", e.target.value)}
                    placeholder="170 1234567"
                    maxLength={11}
                    onlyNumbers
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
                maxLength={10}
                onlyNumbers
              />
            </div>

            <InputField
              id="email"
              label="E-Mail"
              type="email"
              value={formData.email}
              onChange={(e) => {
                const noSpaces = e.target.value.replace(/\s/g, "");
                handleChange("email", noSpaces);
              }}
              placeholder="beispiel@domain.de"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
            />

            <Accordion title="Notfallkontakt">
              <div className="space-y-3 pt-2">
                <InputField
                  id="emergency-name"
                  label="Name der Kontaktperson"
                  value={formData.notfall_name}
                  onChange={(e) => handleChange("notfall_name", e.target.value)}
                  placeholder="z. B. Maria Mustermann"
                  onlyLetters
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
                    onlyLetters
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
                    onlyNumbers
                  />
                </div>
              </div>
            </Accordion>
          </fieldset>
        )}

        {/* Step 3: Clubhouse Details */}
        {currentStep === 3 && (
          <fieldset className="space-y-4 border-0 p-0 m-0">
            <legend className="w-full text-xs font-semibold uppercase tracking-wider text-gray-700 bg-gray-100 p-2 rounded-md mb-2">
              ClubHaus
            </legend>

            <BirthDatePicker
              label="Eintrittsdatum"
              value={formData.eintrittsdatum}
              onChange={(val) => handleChange("eintrittsdatum", val)}
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

        {/* Action Controls */}
        <div className="flex justify-between items-center pt-4 border-t border-gray-100">
          {currentStep > 1 ? (
            <FormButton
              type="button"
              variant="secondary"
              onClick={handlePrevStep}
              disabled={isSubmitting}
            >
              &lt; Zurück
            </FormButton>
          ) : (
            <FormButton
              type="button"
              variant="secondary"
              onClick={onBackToHome}
              disabled={isSubmitting}
            >
              Abbrechen
            </FormButton>
          )}

          <FormButton type="submit" variant="dark" disabled={isSubmitting}>
            {currentStep < 3
              ? "Weiter >"
              : isSubmitting
                ? "Wird gespeichert..."
                : "Speichern"}
          </FormButton>
        </div>
      </form>

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
