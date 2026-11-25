import { useState, useEffect } from "react";
import InputField from "../components/InputField";
import BirthDatePicker from "../components/DatePicker";
import Accordion from "../components/Accordion";
import StepProgress from "../components/StepProgress";
import FormButton from "../components/FormButton";
import ConfirmationCard from "../components/ConfirmationCard";
import SelectDropdown from "../components/SelectDropdown";
import { createMember, fetchLookups, fetchStaff } from "../services/api";
import { useMembers } from "../context/useMembers";

// Step definitions for the multi-step registration wizard
const STEPS = [
  { id: 1, label: "Persönliche Daten" },
  { id: 2, label: "Kontaktdaten" },
  { id: 3, label: "ClubHaus" },
];

// Salutation options strictly aligned with database lookup codes (public.salutations)
const SALUTATION_OPTIONS = [
  { value: "ms", label: "Frau" },
  { value: "mr", label: "Herr" },
  { value: "unspecified", label: "Keine Angabe" },
];

// Gender options strictly aligned with database lookup codes (public.genders)
const GENDER_OPTIONS = [
  { value: "female", label: "Weiblich" },
  { value: "male", label: "Männlich" },
  { value: "diverse", label: "Divers" },
  { value: "unspecified", label: "Keine Angabe" },
];

// European calling codes matching Figma mobile prefix selector
const DIAL_CODE_OPTIONS = [
  { value: "+49", label: "🇩🇪 +49" },
  { value: "+43", label: "🇦🇹 +43" },
  { value: "+41", label: "🇨🇭 +41" },
  { value: "+45", label: "🇩🇰 +45" },
  { value: "+33", label: "🇫🇷 +33" },
  { value: "+39", label: "🇮🇹 +39" },
  { value: "+385", label: "🇭🇷 +385" },
];

// Fallback country ISO codes accepted by public.countries foreign key
const FALLBACK_COUNTRY_OPTIONS = [
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

// Fallback relationship codes accepted by public.contact_relationships foreign key
const FALLBACK_RELATIONSHIP_OPTIONS = [
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

// German display labels for database sector codes (North, South, East, West)
const SECTOR_LABELS_DE = {
  North: "Nord",
  South: "Süd",
  East: "Ost",
  West: "West",
};

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
  ort: "München",
  land: "DE",
  sektor: "",
  mobile_vorwahl: "+49",
  mobile: "",
  telefon: "",
  email: "",

  // Emergency Contact
  notfall_name: "",
  notfall_beziehung: "",
  notfall_vorwahl: "+49",
  notfall_mobile: "",

  // Step 3: ClubHaus (pre-filled with today's date)
  eintrittsdatum: new Date().toISOString().split("T")[0],
  ori_mitarbeiter: "",
  mitgliedsstatus: "mo",
  aktivitaetsstatus: "Aktiv",
};

/**
 * Resolves a 5-digit postal code against the Munich pilot sectors lookup list.
 *
 * @param {string} plz - 5-digit German postal code
 * @param {Array<{postal_code: string, sector: string}>} sectorRows - Rows from GET /api/v1/lookups
 * @returns {{ isValid: boolean, sectorLabel: string }} Lookup match status and German sector label
 */
function resolveMunichSector(plz, sectorRows) {
  if (!plz || plz.length < 5) {
    return { isValid: true, sectorLabel: "" };
  }

  if (!Array.isArray(sectorRows) || sectorRows.length === 0) {
    if (!plz.startsWith("80") && !plz.startsWith("81")) {
      return { isValid: false, sectorLabel: "" };
    }
    const prefix = plz.substring(0, 3);
    if (["803", "807", "808", "809"].includes(prefix))
      return { isValid: true, sectorLabel: "Nord" };
    if (["813", "814", "815"].includes(prefix))
      return { isValid: true, sectorLabel: "Ost" };
    if (["816", "817", "818", "819"].includes(prefix))
      return { isValid: true, sectorLabel: "Ost" };
    if (["806", "812"].includes(prefix))
      return { isValid: true, sectorLabel: "West" };
    return { isValid: true, sectorLabel: "Süd" };
  }

  const match = sectorRows.find((row) => row.postal_code === plz);
  if (!match) {
    return { isValid: false, sectorLabel: "" };
  }

  return {
    isValid: true,
    sectorLabel: SECTOR_LABELS_DE[match.sector] || match.sector,
  };
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
  const [plzWarning, setPlzWarning] = useState("");

  // Dynamic lookup & staff states loaded from backend
  const [sectorList, setSectorList] = useState([]);
  const [staffOptions, setStaffOptions] = useState([]);
  const [countryOptions, setCountryOptions] = useState(
    FALLBACK_COUNTRY_OPTIONS,
  );
  const [relationshipOptions, setRelationshipOptions] = useState(
    FALLBACK_RELATIONSHIP_OPTIONS,
  );

  // UI feedback states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Load lookup dictionaries (including 74 Munich postal codes) and active staff on mount
  useEffect(() => {
    let isMounted = true;

    async function loadReferenceData() {
      try {
        const [lookups, staffList] = await Promise.all([
          fetchLookups(),
          fetchStaff(),
        ]);

        if (!isMounted) return;

        if (Array.isArray(lookups?.sectors)) {
          setSectorList(lookups.sectors);
        }

        if (Array.isArray(lookups?.countries) && lookups.countries.length > 0) {
          setCountryOptions(
            lookups.countries.map((item) => ({
              value: item.code,
              label:
                FALLBACK_COUNTRY_OPTIONS.find((f) => f.value === item.code)
                  ?.label || item.label,
            })),
          );
        }

        if (
          Array.isArray(lookups?.contact_relationships) &&
          lookups.contact_relationships.length > 0
        ) {
          setRelationshipOptions(
            lookups.contact_relationships.map((item) => ({
              value: item.code,
              label:
                FALLBACK_RELATIONSHIP_OPTIONS.find((f) => f.value === item.code)
                  ?.label || item.label,
            })),
          );
        }

        if (Array.isArray(staffList)) {
          setStaffOptions(
            staffList.map((person) => ({
              value: person.staff_id,
              label:
                `${person.first_name || ""} ${person.last_name || ""}`.trim(),
            })),
          );
        }
      } catch {
        // Keep fallback options silently if backend is unreachable
      }
    }

    loadReferenceData();

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Updates form field state and resolves Munich postal code sector when 5 digits are entered.
   *
   * @param {string} field - Field property key
   * @param {string} value - New field value
   */
  function handleChange(field, value) {
    if (field === "postleitzahl") {
      setPlzWarning("");
      if (value.length === 5) {
        const { isValid, sectorLabel } = resolveMunichSector(value, sectorList);
        if (!isValid) {
          setPlzWarning(
            "Hinweis: Diese PLZ gehört nicht zu den 74 Münchner Pilot-Postleitzahlen und wird nicht gespeichert.",
          );
        }
        setFormData((prev) => ({
          ...prev,
          postleitzahl: value,
          sektor: isValid ? sectorLabel : "",
        }));
        return;
      }

      setFormData((prev) => ({
        ...prev,
        postleitzahl: value,
        sektor: "",
      }));
      return;
    }

    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  /**
   * Handles direct step navigation via StepProgress click.
   *
   * @param {number} targetStep - Target step number (1..3)
   */
  function handleStepClick(targetStep) {
    setErrorMessage("");
    setCurrentStep(targetStep);
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
      if (formData.postleitzahl && formData.postleitzahl.length !== 5) {
        setErrorMessage(
          "Bitte geben Sie eine 5-stellige Münchner Postleitzahl ein oder lassen Sie das Feld leer.",
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
   *
   * @param {Object} data - Current form state
   * @returns {Object} Clean JSON payload for POST /api/v1/members
   */
  function buildMemberPayload(data) {
    const fullPhone = data.mobile?.trim()
      ? `${data.mobile_vorwahl || "+49"}${data.mobile.trim().replace(/^0+/, "")}`
      : data.telefon?.trim() || null;

    const rawPlz = data.postleitzahl?.trim() || "";
    const isSupportedMunichPlz =
      rawPlz.length === 5 && resolveMunichSector(rawPlz, sectorList).isValid;

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
      postal_code: isSupportedMunichPlz ? rawPlz : null,
      city: data.ort?.trim() || null,
      country: data.land || "DE",
    };

    if (data.notfall_name?.trim() && data.notfall_mobile?.trim()) {
      payload.emergency_contact = {
        name: data.notfall_name.trim(),
        phone: `${data.notfall_vorwahl || "+49"}${data.notfall_mobile.trim().replace(/^0+/, "")}`,
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

      if (addMember) {
        addMember(createdMember);
      }

      setShowConfirmation(false);
      setSaveSuccess(true);
      setCurrentStep(1);
      setPlzWarning("");
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

  const salutationLabel =
    formData.anrede && formData.anrede !== "unspecified"
      ? SALUTATION_OPTIONS.find((opt) => opt.value === formData.anrede)?.label
      : "";

  const staffDisplayName =
    staffOptions.find((s) => s.value === formData.ori_mitarbeiter)?.label ||
    formData.ori_mitarbeiter ||
    "-";

  const confirmationItems = [
    { section: "Persönliche Daten" },
    {
      label: "Name",
      value:
        `${salutationLabel ? salutationLabel + " " : ""}${formData.vorname} ${formData.nachname}`.trim(),
    },
    { label: "Geburtsdatum", value: formData.geburtsdatum || "-" },
    { section: "Kontaktdaten" },
    { label: "Straße & Hausnummer", value: formData.strasse_hausnummer || "-" },
    { label: "Postleitzahl (PLZ)", value: formData.postleitzahl || "-" },
    { label: "Sektor", value: formData.sektor || "-" },
    { label: "Stadt", value: formData.ort || "-" },
    {
      label: "Mobil",
      value: formData.mobile
        ? `${formData.mobile_vorwahl}${formData.mobile}`
        : "-",
    },
    { label: "E-Mail", value: formData.email || "-" },
    { section: "ClubHaus" },
    { label: "Eintrittsdatum", value: formData.eintrittsdatum || "-" },
    {
      label: "Orientierungsgespräch geführt von",
      value: staffDisplayName,
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
          <StepProgress
            steps={STEPS}
            currentStep={currentStep}
            onStepClick={handleStepClick}
          />

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
                    onClear={() => handleChange("anrede", "")}
                    options={SALUTATION_OPTIONS}
                    placeholder="Bitte wählen"
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

                <SelectDropdown
                  id="gender"
                  label="Geschlecht"
                  value={formData.geschlecht}
                  onChange={(e) => handleChange("geschlecht", e.target.value)}
                  onClear={() => handleChange("geschlecht", "")}
                  options={GENDER_OPTIONS}
                  placeholder="Geschlecht auswählen"
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
                  placeholder="z. B. Musterstraße 123"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <InputField
                      id="plz"
                      label="Postleitzahl (PLZ)"
                      value={formData.postleitzahl}
                      onChange={(e) =>
                        handleChange("postleitzahl", e.target.value)
                      }
                      placeholder="z. B. 81539"
                      maxLength={5}
                      onlyNumbers
                    />
                    {plzWarning && (
                      <p className="text-xs text-amber-700 mt-1" role="status">
                        {plzWarning}
                      </p>
                    )}
                  </div>
                  <InputField
                    id="city"
                    label="Stadt"
                    value={formData.ort}
                    onChange={(e) => handleChange("ort", e.target.value)}
                    placeholder="z. B. München"
                    onlyLetters
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SelectDropdown
                    id="country"
                    label="Land"
                    value={formData.land}
                    onChange={(e) => handleChange("land", e.target.value)}
                    onClear={() => handleChange("land", "")}
                    options={countryOptions}
                    placeholder="Land auswählen"
                  />

                  <InputField
                    id="sector"
                    label="Sektor"
                    value={formData.sektor}
                    onChange={(e) => handleChange("sektor", e.target.value)}
                    onClear={() => handleChange("sektor", "")}
                    placeholder="Sektor auswählen"
                    readOnly
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="mobile"
                      className="text-sm font-medium text-black"
                    >
                      Mobil
                    </label>
                    <div className="flex h-11 rounded-md border border-gray-500 bg-white overflow-hidden focus-within:border-[#0B84CF] focus-within:ring-2 focus-within:ring-[#0B84CF]/25">
                      <select
                        aria-label="Ländervorwahl Mobil"
                        value={formData.mobile_vorwahl}
                        onChange={(e) =>
                          handleChange("mobile_vorwahl", e.target.value)
                        }
                        className="px-2.5 border-r border-gray-300 bg-white text-black text-sm focus:outline-none cursor-pointer"
                      >
                        {DIAL_CODE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
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
                  placeholder="z. B. name@domain.de"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                />

                {/* Collapsible Emergency Contact Section */}
                <Accordion title="Notfallkontakt">
                  <div className="space-y-4">
                    <InputField
                      id="emergency-name"
                      label="Name (Notfall)"
                      value={formData.notfall_name}
                      onChange={(e) =>
                        handleChange("notfall_name", e.target.value)
                      }
                      placeholder="Name"
                      onlyLetters
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <SelectDropdown
                        id="emergency-relation"
                        label="Beziehung"
                        value={formData.notfall_beziehung}
                        onChange={(e) =>
                          handleChange("notfall_beziehung", e.target.value)
                        }
                        onClear={() => handleChange("notfall_beziehung", "")}
                        options={relationshipOptions}
                        placeholder="Bitte wählen"
                      />

                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="emergency-phone"
                          className="text-sm font-medium text-black"
                        >
                          Mobil (Notfall)
                        </label>
                        <div className="flex h-11 rounded-md border border-gray-500 bg-white overflow-hidden focus-within:border-[#0B84CF] focus-within:ring-2 focus-within:ring-[#0B84CF]/25">
                          <select
                            aria-label="Ländervorwahl Notfallkontakt"
                            value={formData.notfall_vorwahl}
                            onChange={(e) =>
                              handleChange("notfall_vorwahl", e.target.value)
                            }
                            className="px-2.5 border-r border-gray-300 bg-white text-black text-sm focus:outline-none cursor-pointer"
                          >
                            {DIAL_CODE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
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
                  onClear={() => handleChange("ori_mitarbeiter", "")}
                  options={staffOptions}
                  placeholder={
                    staffOptions.length > 0
                      ? "Bitte wählen"
                      : "Keine Mitarbeitenden hinterlegt"
                  }
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
