const ATTRIBUTE = "data-input-modality";

/**
 * Marks the document as `keyboard` once the user presses Tab and as `pointer` on the next
 * press of a mouse, pen or finger. Text fields match `:focus-visible` even after a click, so
 * the focus ring reads this instead: it shows for keyboard navigation only. Only Tab counts,
 * so typing after a click does not bring the ring in.
 */
export function trackInputModality(root: HTMLElement = document.documentElement): () => void {
  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Tab") root.setAttribute(ATTRIBUTE, "keyboard");
  }
  function onPointerDown() {
    root.setAttribute(ATTRIBUTE, "pointer");
  }

  root.setAttribute(ATTRIBUTE, "pointer");
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("pointerdown", onPointerDown, true);

  return () => {
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("pointerdown", onPointerDown, true);
    root.removeAttribute(ATTRIBUTE);
  };
}
