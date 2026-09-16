import FormButton from './FormButton';

/**
 * Accessible and semantic confirmation dialog for verifying form records.
 * Uses native <dialog>, <header>, <dl>/<dt>/<dd>, and <footer> tags.
 *
 * @param {boolean} isOpen - Controls visibility of the confirmation view.
 * @param {string} title - Dialog header title.
 * @param {Array<{label: string, value: string|number}>} items - Key-value rows to verify.
 * @param {function} onCancel - Return to form editing.
 * @param {function} onConfirm - Confirm and finalize record submission.
 */
export default function ConfirmationCard({
  isOpen,
  title = 'Angaben überprüfen',
  items = [],
  onCancel,
  onConfirm,
}) {
  // Do not render anything when closed
  if (!isOpen) return null;

  return (
    // Fixed backdrop wrapper over full viewport
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      
      {/* Semantic HTML5 dialog container (m-auto centers the native dialog element) */}
      <dialog
        open
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="m-auto max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-200 p-0 overflow-hidden text-gray-900"
      >
        {/* Semantic Header */}
        <header className="bg-gray-200 py-3 px-4 text-center border-b border-gray-300">
          <h3 id="dialog-title" className="font-semibold text-gray-800 text-sm">
            {title}
          </h3>
        </header>

        {/* Semantic Body with Description List for Key-Value data */}
        <div className="p-6 space-y-4 text-xs sm:text-sm">
          <dl className="space-y-3">
            {items.map((item, index) => (
              <div
                key={index}
                className="flex justify-between items-center border-b border-gray-100 pb-2.5"
              >
                <dt className="text-gray-500 font-medium">{item.label}:</dt>
                <dd className="text-gray-900 font-semibold text-right m-0">
                  {item.value || '—'}
                </dd>
              </div>
            ))}
          </dl>

          {/* Semantic Footer for Action Buttons */}
          <footer className="flex justify-end gap-3 pt-4">
            <FormButton type="button" variant="secondary" onClick={onCancel}>
              Abbrechen
            </FormButton>
            <FormButton type="button" variant="dark" onClick={onConfirm}>
              Speichern
            </FormButton>
          </footer>
        </div>

      </dialog>
    </div>
  );
}