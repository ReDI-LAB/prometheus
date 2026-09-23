/**
 * StepProgress Component
 * Renders an accessible multi-step progression indicator.
 *
 * @param {Array<{ id: number, label: string }>} steps - List of steps
 * @param {number} currentStep - The currently active step index (1-based)
 */
export default function StepProgress({ steps = [], currentStep = 1 }) {
  return (
    <nav aria-label="Fortschritt der Registrierung" className="w-full mb-6">
      <ol className="flex items-center justify-between w-full">
        {steps.map((step, index) => {
          const isActive = step.id === currentStep;
          const isCompleted = step.id < currentStep;

          return (
            <li
              key={step.id}
              aria-current={isActive ? "step" : undefined}
              className="flex items-center flex-1 last:flex-none"
            >
              <div className="flex items-center gap-2">
                {/* Step circle indicator */}
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    isActive
                      ? "bg-gray-900 text-white"
                      : isCompleted
                        ? "bg-teal-700 text-white"
                        : "border border-gray-300 text-gray-400 bg-white"
                  }`}
                >
                  {isCompleted ? "✓" : step.id}
                </span>

                {/* Step text label */}
                <span
                  className={`text-xs font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? "text-gray-900 font-bold"
                      : isCompleted
                        ? "text-teal-800"
                        : "text-gray-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {/* Connecting line between steps */}
              {index < steps.length - 1 && (
                <div
                  aria-hidden="true"
                  className={`flex-1 h-0.5 mx-3 transition-colors ${
                    step.id < currentStep ? "bg-teal-700" : "bg-gray-200"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
