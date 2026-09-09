import { useEffect, useRef } from "react";

/**
 * Shared behaviour for the two things that cover the app — the entry reader and
 * the urge sheet.
 *
 * Escape closes, the page behind stops scrolling, and focus moves into the
 * overlay and back to wherever it came from on the way out. Without the last
 * part, dismissing the sheet drops keyboard focus back to the top of the
 * document.
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
      }
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
