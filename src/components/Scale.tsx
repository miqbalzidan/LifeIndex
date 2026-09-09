import type { Rating } from "../types.ts";

const STEPS: Rating[] = [1, 2, 3, 4, 5];

interface ScaleProps {
  label: string;
  value: Rating | null;
  onChange: (value: Rating) => void;
  /** The taller variant used inside the urge sheet. */
  tall?: boolean;
}

/**
 * A 1–5 scale. Rendered as a radio group so the numbers are announced as one
 * choice rather than five unrelated buttons — the visual design gives you that
 * for free, a screen reader needs telling.
 */
export function Scale({ label, value, onChange, tall = false }: ScaleProps) {
  return (
    <div className={tall ? "scale scale--tall" : "scale"} role="radiogroup" aria-label={label}>
      {STEPS.map((step) => (
        <button
          key={step}
          type="button"
          role="radio"
          aria-checked={value === step}
          aria-label={`${label} ${step} of 5`}
          className="scale-step"
          onClick={() => onChange(step)}
        >
          {step}
        </button>
      ))}
    </div>
  );
}
