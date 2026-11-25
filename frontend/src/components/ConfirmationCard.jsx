import FormButton from "./FormButton";

/**
 * Accessible and semantic confirmation dialog for verifying form records.
 * Supports flat key-value rows as well as optional section headers.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Controls visibility of the confirmation dialog
 * @param {string} [props.title] - Dialog header title
 * @param {Array<{label?: string, value?: string|number, section?: string}>} props.items - Rows or section headings to display
 * @param {Function} props.onCancel - Return to form editing ("Zurück")
 * @param {Function} props.onConfirm - Confirm and finalize record submission ("Bestätigen")
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
        className="m-auto max-w-md w-full bg-white rounded-xl shadow-2xl border border-gray-200 p-0 overflow-hidden text-black"
      >
        {/* Dark Blue Dialog Header (#05619A) */}
        <header className="bg-[#05619A] py-3.5 px-6 text-white">
          <h3 id="dialog-title" className="font-semibold text-base">
            {title}
          </h3>
        </header>

        {/* Semantic Body with Description List */}
        <div className="p-6 space-y-4 text-sm max-h-[75vh] overflow-y-auto">
          <dl className="space-y-2.5">
            {items.map((item, index) => {
              if (item.section) {
                return (
                  <div
                    key={`section-${index}`}
                    className={`text-xs font-semibold text-[#5E5E5F] uppercase tracking-wider ${
                      index > 0 ? "pt-3 border-t border-gray-200" : ""
                    }`}
                  >
                    {item.section}
                  </div>
                );
              }

              return (
                <div
                  key={`${item.label}-${index}`}
                  className="flex justify-between items-baseline gap-4 border-b border-gray-100 pb-2"
                >
                  <dt className="text-[#5E5E5F] font-normal shrink-0">
                    {item.label}:
                  </dt>
                  <dd className="text-black font-semibold text-right m-0 break-words">
                    {item.value || "—"}
                  </dd>
                </div>
              );
            })}
          </dl>

          {/* Footer Action Buttons: "Zurück" (left) and "Bestätigen" (right) */}
          <footer className="grid grid-cols-2 items-center gap-4 pt-3">
            <div className="flex justify-center">
              <FormButton type="button" variant="ghost" onClick={onCancel}>
                Zurück
              </FormButton>
            </div>
            <FormButton
              type="button"
              variant="primary"
              onClick={onConfirm}
              className="w-full"
            >
              Bestätigen
            </FormButton>
          </footer>
        </div>
      </dialog>
    </div>
  );
}
