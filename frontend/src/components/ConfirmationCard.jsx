import FormButton from "./FormButton";

/**
 * Accessible and semantic confirmation dialog matching Sahu's Figma Hi-Fi review card.
 */
export default function ConfirmationCard({
  isOpen,
  title = "Daten überprüfen",
  items = [],
  onCancel,
  onConfirm,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <dialog
        open
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="m-auto max-w-md w-full bg-white rounded-xl shadow-xl border border-gray-200 p-0 overflow-hidden text-black"
      >
        {/* Dark Blue Header Bar (#05619A) */}
        <header className="bg-[#05619A] py-3.5 px-6 text-left">
          <h3 id="dialog-title" className="font-semibold text-white text-lg">
            {title}
          </h3>
        </header>

        {/* Key-Value Summary List */}
        <div className="p-6 space-y-5 text-sm">
          <dl className="divide-y divide-gray-200">
            {items.map((item, index) => (
              <div
                key={index}
                className="flex justify-between items-center py-3 first:pt-0"
              >
                <dt className="text-[#5E5E5F] font-normal">{item.label}:</dt>
                <dd className="text-black font-medium text-right m-0">
                  {item.value || "—"}
                </dd>
              </div>
            ))}
          </dl>

          {/* Footer: "Zurück" text button left, blue "Bestätigen" button right */}
          <footer className="flex justify-between items-center pt-2">
            <FormButton type="button" variant="ghost" onClick={onCancel}>
              Zurück
            </FormButton>
            <FormButton type="button" variant="primary" onClick={onConfirm}>
              Bestätigen
            </FormButton>
          </footer>
        </div>
      </dialog>
    </div>
  );
}
