import { useState } from "react";
import InputField from "../components/InputField";
import BirthDatePicker from "../components/DatePicker";
import RadioGroup from "../components/RadioGroup";
import Accordion from "../components/Accordion";
import StepProgress from "../components/StepProgress";
import FormButton from "../components/FormButton";
import ConfirmationCard from "../components/ConfirmationCard";
import SelectDropdown from "../components/SelectDropdown";
import { createMember } from "../services/api";
import { useMembers } from "../context/useMembers";

// Step definitions for the multi-step registration wizard
const STEPS = [
  { id: 1, label: "Persönliche Daten" },
  { id: 2, label: "Kontaktdaten" },
  { id: 3, label: "ClubHaus" },
];

// Salutation options mapped to V2 database lookup codes
const SALUTATION_OPTIONS = [
  { value: "ms", label: "Frau" },
  { value: "mr", label: "Herr" },
  { value: "unspecified", label: "Keine Angabe" },
];

// Gender options mapped to V2 database lookup codes
const GENDER_OPTIONS = [
  { value: "male", label: "Männlich" },
  { value: "female", label: "Weiblich" },
  { value: "diverse", label: "Divers" },
];

// Country ISO codes accepted by public.countries foreign key
const COUNTRY_OPTIONS = [
  { value: "DE", label: "Deutschland" },
  { value: "AT", label: "Österreich" },
  { value: "CH", label: "Schweiz" },
  { value: "IT", label: "Italien" },
  { value: "FR", label: "Frankreich" },
  { value: "ES", label: "Spanien" },
  { value: "NL", label: "Niederlande" },
  { value: "GB", label: "Großbritannien" },
  { value: "NO", label: "Norwegen" },
  { value: "GI", label: "Gibraltar" },
];

// Relationship codes accepted by public.contact_relationships foreign key
const RELATIONSHIP_OPTIONS = [
  { value: "mother", label: "Mutter" },
  { value: "father", label: "Vater" },
  { value: "wife", label: "Ehefrau" },
  { value: "husband", label: "Ehemann" },
  { value: "daughter", label: "Tochter" },
  { value: "son", label: "Sohn" },
  { value: "sister", label: "Schwester" },
  { value: "brother", label: "Bruder" },
  { value: "other", label: "Sonstige" },
];

// Predefined staff list for the orientation interview dropdown
const STAFF_OPTIONS = [
  { value: "Emma Weber", label: "Emma Weber" },
  { value: "Hannah Müller", label: "Hannah Müller" },
  { value: "Merle Schneider", label: "Merle Schneider" },
  { value: "Mia Weber", label: "Mia Weber" },
];

// Initial blank form state matching database column requirements
const INITIAL_FORM_DATA = {
  // Step 1: Personal Details
  anrede: "",
  vorname: "",
  nachname: "",
  geburtsdatum: "",
  geschlecht: "",

  // Step 2: Contact Details
  strasse_hausnummer: "",
  postleitzahl: "",
  ort: "",
  land: "DE",
  sektor: "",
  mobile: "",
  telefon: "",
  email: "",

  // Emergency Contact
  notfall_name: "",
  notfall_beziehung: "",
  notfall_mobile: "",

  // Step 3: ClubHaus (pre-filled with today's date)
  eintrittsdatum: new Date().toISOString().split("T")[0],
  ori_mitarbeiter: "",
  mitgliedsstatus: "mo",
  aktivitaetsstatus: "Aktiv",
};

/**
 * Maps a 5-digit Munich postal code to its administrative sector.
 *
 * @param {string} plz - 5-digit German postal code
 * @returns {string} Determined sector name in German
 */
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

/**
 * Validates basic email formatting: text@domain.tld.
 *
 * @param {string} email - Email address string to test
 * @returns {boolean} True if valid or empty, false otherwise
 */
function isValidEmail(email) {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * NewMemberForm Component
 * 3-step wizard for capturing member master data and persisting to the backend.
 */
export default function NewMemberForm() {
  const { addMember } = useMembers();

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);

  // UI feedback states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  /**
   * Updates form field state and triggers sector recalculation when postal code has 5 digits.
   *
   * @param {string} field - Field property key
   * @param {string} value - New field value
   */
  function handleChange(field, value) {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === "postleitzahl" && value.length === 5) {
        updated.sektor = getSectorFromPlz(value);
      }
      return updated;
    });
  }

  /**
   * Validates mandatory inputs for the current step and advances the wizard.
   *
   * @param {React.FormEvent} e - Form submit event
   */
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

  /**
   * Steps one step backward in the wizard flow.
   */
  function handlePrevStep() {
    setErrorMessage("");
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  }

  /**
   * Maps German frontend form state to the backend's MemberCreate Pydantic schema.
   * Strictly excludes unknown fields so backend extra="forbid" validation passes.
   *
   * @param {Object} data - Current form state
   * @returns {Object} Clean JSON payload for POST /api/v1/members
   */
  function buildMemberPayload(data) {
    const fullPhone = data.mobile?.trim()
      ? `+49${data.mobile.trim().replace(/^0+/, "")}`
      : data.telefon?.trim() || null;

    const payload = {
      first_name: data.vorname.trim(),
      last_name: data.nachname.trim(),
      date_of_birth: data.geburtsdatum,
      join_date: data.eintrittsdatum,
      salutation: data.anrede || null,
      gender: data.geschlecht || null,
      phone: fullPhone,
      email: data.email?.trim() || null,
      street_address: data.strasse_hausnummer?.trim() || null,
      postal_code: data.postleitzahl?.trim() || null,
      city: data.ort?.trim() || null,
      country: data.land || "DE",
    };

    // Include nested emergency_contact only if both required fields (name & phone) are filled
    if (data.notfall_name?.trim() && data.notfall_mobile?.trim()) {
      payload.emergency_contact = {
        name: data.notfall_name.trim(),
        phone: data.notfall_mobile.trim(),
        relationship: data.notfall_beziehung || null,
      };
    }

    return payload;
  }

  /**
   * Submits the new member record to the API, updates global context, and resets the wizard.
   */
  async function handleFinalSave() {
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const payload = buildMemberPayload(formData);
      const createdMember = await createMember(payload);

      // Update global member cache immediately so BAB & Phone Log show the new member
      if (addMember) {
        addMember(createdMember);
      }

      setShowConfirmation(false);
      setSaveSuccess(true);
      setCurrentStep(1);
      setFormData(INITIAL_FORM_DATA);

      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err) {
      setShowConfirmation(false);
      setErrorMessage(`Fehler beim Speichern des Mitglieds: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Resolve human-readable German label for salutation in the confirmation summary
  const salutationLabel =
    formData.anrede && formData.anrede !== "unspecified"
      ? SALUTATION_OPTIONS.find((opt) => opt.value === formData.anrede)?.label
      : "";

  // Key-value summary rows displayed inside ConfirmationCard
  const confirmationItems = [
    {
      label: "Name",
      value:
        `${salutationLabel ? salutationLabel + " " : ""}${formData.vorname} ${formData.nachname}`.trim(),
    },
    { label: "Geburtsdatum", value: formData.geburtsdatum || "-" },
    { label: "Straße & Hausnummer", value: formData.strasse_hausnummer || "-" },
    { label: "Postleitzahl (PLZ)", value: formData.postleitzahl || "-" },
    { label: "Stadt", value: formData.ort || "-" },
    { label: "Mobil", value: formData.mobile ? `+49 ${formData.mobile}` : "-" },
    { label: "E-Mail", value: formData.email || "-" },
    { label: "Eintrittsdatum", value: formData.eintrittsdatum || "-" },
    {
      label: "Orientierungsgespräch geführt von",
      value: formData.ori_mitarbeiter || "-",
    },
  ];

  return (
    <article aria-labelledby="member-registration-heading" className="app-card">
      {/* Dark Blue Header Bar (#05619A) */}
      <header className="app-card-header">
        <h2 id="member-registration-heading">Neues Mitglied anlegen</h2>
      </header>

      <div className="p-6 sm:p-8">
        {/* Error notification banner */}
        {errorMessage && (
          <aside
            role="alert"
            aria-live="assertive"
            className="mb-4 p-3 bg-red-50 border border-[#B71D1D]/30 text-[#B71D1D] text-xs font-medium rounded-md flex items-center justify-between"
          >
            <span>✕ {errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage("")}
              className="text-[#B71D1D] font-bold ml-2 text-sm cursor-pointer"
              aria-label="Fehlermeldung schließen"
            >
              ✕
            </button>
          </aside>
        )}

        {/* Inner bordered form container */}
        <div className="app-form-box">
          <StepProgress steps={STEPS} currentStep={currentStep} />

          <form onSubmit={handleNextStep} className="space-y-5">
            {/* Step 1: Personal Details */}
            {currentStep === 1 && (
              <fieldset className="space-y-5 border-0 p-0 m-0">
                <legend className="app-section-banner">
                  Persönliche Daten
                </legend>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <SelectDropdown
                    id="salutation"
                    label="Anrede"
                    value={formData.anrede}
                    onChange={(e) => handleChange("anrede", e.target.value)}
                    options={SALUTATION_OPTIONS}
                  />

                  <InputField
                    id="first-name"
                    label="Vorname"
                    value={formData.vorname}
                    onChange={(e) => handleChange("vorname", e.target.value)}
                    placeholder="Vorname"
                    required
                    onlyLetters
                  />

                  <InputField
                    id="last-name"
                    label="Nachname"
                    value={formData.nachname}
                    onChange={(e) => handleChange("nachname", e.target.value)}
                    placeholder="Nachname"
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
                  hideLabel
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
                <legend className="app-section-banner">Kontaktdaten</legend>

                <InputField
                  id="street"
                  label="Straße & Hausnummer"
                  value={formData.strasse_hausnummer}
                  onChange={(e) =>
                    handleChange("strasse_hausnummer", e.target.value)
                  }
                  placeholder="z. B Musterstraße 123"
                  required
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField
                    id="plz"
                    label="Postleitzahl (PLZ)"
                    value={formData.postleitzahl}
                    onChange={(e) =>
                      handleChange("postleitzahl", e.target.value)
                    }
                    placeholder="12345"
                    maxLength={5}
                    onlyNumbers
                    required
                  />
                  <InputField
                    id="city"
                    label="Stadt"
                    value={formData.ort}
                    onChange={(e) => handleChange("ort", e.target.value)}
                    placeholder="z. B. München"
                    onlyLetters
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SelectDropdown
                    id="country"
                    label="Land"
                    value={formData.land}
                    onChange={(e) => handleChange("land", e.target.value)}
                    options={COUNTRY_OPTIONS}
                  />

                  <InputField
                    id="sector"
                    label="Sektor"
                    value={formData.sektor}
                    onChange={(e) => handleChange("sektor", e.target.value)}
                    placeholder="Süd"
                    readOnly
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Mobile phone input with German country prefix */}
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="mobile"
                      className="text-sm font-medium text-black"
                    >
                      Mobil
                    </label>
                    <div className="flex h-11 rounded-md border border-gray-500 bg-white overflow-hidden focus-within:border-[#0B84CF] focus-within:ring-2 focus-within:ring-[#0B84CF]/25">
                      <span className="inline-flex items-center gap-1 px-3 border-r border-gray-300 bg-white text-black text-sm select-none">
                        🇩🇪 +49
                      </span>
                      <input
                        id="mobile"
                        type="tel"
                        value={formData.mobile}
                        onChange={(e) =>
                          handleChange(
                            "mobile",
                            e.target.value.replace(/\D/g, "").slice(0, 11),
                          )
                        }
                        placeholder="170 1234567"
                        className="w-full px-3 text-base text-black placeholder-[#B8BBBD] focus:outline-none"
                      />
                    </div>
                  </div>

                  <InputField
                    id="phone"
                    label="Telefon"
                    type="tel"
                    value={formData.telefon}
                    onChange={(e) => handleChange("telefon", e.target.value)}
                    placeholder="089 1234567"
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
                  placeholder="z. B. beispiel@domain.de"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                />

                {/* Collapsible Emergency Contact Section */}
                <Accordion title="Notfallkontakt">
                  <div className="space-y-4">
                    <InputField
                      id="emergency-street"
                      label="Straße & Hausnummer"
                      value={formData.notfall_name}
                      onChange={(e) =>
                        handleChange("notfall_name", e.target.value)
                      }
                      placeholder="z. B Musterstraße 123"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <SelectDropdown
                        id="emergency-relation"
                        label="Beziehung"
                        value={formData.notfall_beziehung}
                        onChange={(e) =>
                          handleChange("notfall_beziehung", e.target.value)
                        }
                        options={RELATIONSHIP_OPTIONS}
                        placeholder="Bitte wählen"
                      />

                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="emergency-phone"
                          className="text-sm font-medium text-black"
                        >
                          Mobil
                        </label>
                        <div className="flex h-11 rounded-md border border-gray-500 bg-white overflow-hidden focus-within:border-[#0B84CF] focus-within:ring-2 focus-within:ring-[#0B84CF]/25">
                          <span className="inline-flex items-center gap-1 px-3 border-r border-gray-300 bg-white text-black text-sm select-none">
                            🇩🇪 +49
                          </span>
                          <input
                            id="emergency-phone"
                            type="tel"
                            value={formData.notfall_mobile}
                            onChange={(e) =>
                              handleChange(
                                "notfall_mobile",
                                e.target.value.replace(/\D/g, "").slice(0, 11),
                              )
                            }
                            placeholder="170 1234567"
                            className="w-full px-3 text-base text-black placeholder-[#B8BBBD] focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </Accordion>
              </fieldset>
            )}

            {/* Step 3: Clubhouse Details */}
            {currentStep === 3 && (
              <fieldset className="space-y-5 border-0 p-0 m-0">
                <legend className="app-section-banner">ClubHaus</legend>

                <BirthDatePicker
                  label="Eintrittsdatum"
                  value={formData.eintrittsdatum}
                  onChange={(val) => handleChange("eintrittsdatum", val)}
                  required
                />

                <SelectDropdown
                  id="ori-interview"
                  label="Orientierungsgespräch geführt von"
                  value={formData.ori_mitarbeiter}
                  onChange={(e) =>
                    handleChange("ori_mitarbeiter", e.target.value)
                  }
                  options={STAFF_OPTIONS}
                  placeholder="Bitte wählen"
                />
              </fieldset>
            )}

            {/* Footer navigation buttons */}
            <div className="grid grid-cols-2 items-center pt-4">
              <div className="flex justify-center">
                {currentStep > 1 && (
                  <FormButton
                    type="button"
                    variant="ghost"
                    onClick={handlePrevStep}
                    disabled={isSubmitting}
                  >
                    Zurück
                  </FormButton>
                )}
              </div>

              <FormButton
                type="submit"
                variant="primary"
                disabled={isSubmitting}
                className="w-full"
              >
                {currentStep < 3
                  ? "Weiter"
                  : isSubmitting
                    ? "Wird gespeichert..."
                    : "Speichern"}
              </FormButton>
            </div>
          </form>
        </div>
      </div>

      {/* Figma Success Overlay Card ("Super! Daten erfolgreich gespeichert.") */}
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

      {/* Verification modal dialog before final API persistence */}
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
