import { useEffect, useState } from "react";
import { useReducedMotion } from "./use-reduced-motion";

/** How long a figure stays highlighted after it changes. */
export const TICK_FLASH_MS = 1_000;

/**
 * True for about a second after `value` changes for the same `identity`, so a figure that just
 * ticked can stand out. A first value, or a new identity (another asset in the same place after a
 * page change), never flashes; and it never flashes when the user asked for reduced motion.
 */
export function useTickFlash(identity: string, value: string): boolean {
  const reduced = useReducedMotion();
  const [last, setLast] = useState({ identity, value });
  const [flashing, setFlashing] = useState(false);

  // Adjusting state while rendering is React's way to react to a changed input without an effect.
  if (last.identity !== identity) {
    setLast({ identity, value });
    setFlashing(false);
  } else if (last.value !== value) {
    setLast({ identity, value });
    setFlashing(true);
  }

  useEffect(() => {
    if (!flashing) return;
    const timer = setTimeout(() => {
      setFlashing(false);
    }, TICK_FLASH_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [flashing, last]);

  return flashing && !reduced;
}
