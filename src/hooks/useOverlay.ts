import { useEffect, useRef } from "react";

/** Everything inside an overlay that can take keyboard focus. */
const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Shared behaviour for the two things that cover the app — the entry reader and
 * the urge sheet.
 *
 * Escape closes, the page behind stops scrolling, Tab stays inside, and focus
 * moves into the overlay and back to wherever it came from on the way out.
 * Without the last part, dismissing the sheet drops keyboard focus back to the
 * top of the document; without the trap, `aria-modal` claims a modality that
 * Tab walks straight out of, into the screen behind the scrim.
 *
 * Restoring is skipped when the opener has since left the DOM — focusing a
 * detached node silently does nothing, so the caller has to place focus itself
 * in that case.
 */
export function useOverlay<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const root = ref.current;
      if (!root) return;

      // Recomputed per keystroke rather than cached on open: the sheet's own
      // controls come and go as it is filled in.
      const stops = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.getClientRects().length > 0
      );
      const first = stops[0];
      const last = stops[stops.length - 1];
      const active = document.activeElement;

      if (!first || !last) {
        e.preventDefault();
        root.focus({ preventScroll: true });
      } else if (e.shiftKey && (active === root || active === first || !root.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !root.contains(active))) {
        e.preventDefault();
        first.focus();
      }
      // Otherwise the browser's own order is already correct and inside.
    };

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    // `preventScroll` keeps the overlay from jumping to its own top on open.
    ref.current?.focus({ preventScroll: true });

    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKeyDown);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [onClose]);

  return ref;
}
