import { useSyncExternalStore } from "react";

/**
 * Whether a CSS media query matches now, and again whenever it changes. Use it only where the
 * layout changes what is rendered (a card list instead of a table, other copy); anything that is
 * only a matter of style stays in CSS with the `tablet:` and `desktop:` variants. Where the browser
 * cannot match media, as in the unit tests, nothing matches, so the desktop layout renders.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== "function") return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => {
        list.removeEventListener("change", onChange);
      };
    },
    () => (typeof window.matchMedia === "function" ? window.matchMedia(query).matches : false),
    () => false,
  );
}

/** The mobile layout of ADR-010 point 9: 360 to 560 px wide (tablet starts at 561 px). */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 560px)");
}
