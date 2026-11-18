/**
 * StepProgress Component
 * Renders the 3-step registration indicator matching Sahu's Figma Hi-Fi design.
 */
export default function StepProgress({ steps = [], currentStep = 1 }) {
  return (
    <nav aria-label="Fortschritt der Registrierung" className="w-full mb-6">
      <ol className="flex items-center justify-center gap-8 w-full">
        {steps.map((step) => {
          const isActive = step.id === currentStep;

          return (
            <li
              key={step.id}
              aria-current={isActive ? "step" : undefined}
              className="flex items-center gap-2"
            >
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                  isActive
                    ? "border-[#0E8B06] text-[#0E8B06] bg-white"
                    : "border-[#B8BBBD] text-[#B8BBBD] bg-white"
                }`}
              >
                {step.id}
              </span>

              <span
                className={`text-sm font-semibold whitespace-nowrap transition-colors ${
                  isActive ? "text-[#0E8B06]" : "text-[#B8BBBD]"
                }`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
