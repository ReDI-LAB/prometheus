/**
 * StepProgress Component
 * Renders an accessible multi-step progression indicator with optional click navigation.
 *
 * @param {Object} props
 * @param {Array<{ id: number, label: string }>} props.steps - Ordered list of wizard steps
 * @param {number} props.currentStep - Currently active step ID (1-based)
 * @param {Function} [props.onStepClick] - Optional callback fired with target step ID when clicked
 */
export default function StepProgress({
  steps = [],
  currentStep = 1,
  onStepClick,
}) {
  return (
    <nav aria-label="Fortschritt der Registrierung" className="w-full mb-6">
      <ol className="flex items-center justify-center gap-4 sm:gap-8 w-full">
        {steps.map((step) => {
          const isActive = step.id === currentStep;
          const isInteractive = typeof onStepClick === "function";

          return (
            <li
              key={step.id}
              aria-current={isActive ? "step" : undefined}
              className="flex items-center"
            >
              <button
                type="button"
                disabled={!isInteractive}
                onClick={() => isInteractive && onStepClick(step.id)}
                className={`flex items-center gap-2 focus:outline-none ${
                  isInteractive
                    ? "cursor-pointer hover:opacity-80"
                    : "cursor-default"
                }`}
              >
                {/* Step circle indicator */}
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                    isActive
                      ? "border-2 border-[#0E8B06] text-[#0E8B06] bg-white"
                      : "border border-[#84888B] text-[#84888B] bg-white"
                  }`}
                >
                  {step.id}
                </span>

                {/* Step text label */}
                <span
                  className={`text-xs sm:text-sm whitespace-nowrap transition-colors ${
                    isActive
                      ? "text-[#0E8B06] font-semibold"
                      : "text-[#84888B] font-medium"
                  }`}
                >
                  {step.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
