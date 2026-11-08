import { useEffect } from "react";
import { useMotionStore } from "@/stores/motion-store";
import { usePreferences } from "./use-preferences";

/**
 * Applies the reduced-motion preference the user saved, from the same query Settings writes to, so
 * saving it there takes effect at once. Nothing saved means the animations stay on; the system
 * setting is read apart by `useReducedMotion`.
 */
export function useSavedMotion() {
  const preferences = usePreferences();
  const setReducedMotion = useMotionStore((state) => state.setReducedMotion);
  const saved = preferences.data?.reducedMotion;

  useEffect(() => {
    if (preferences.isSuccess) setReducedMotion(saved ?? false);
  }, [preferences.isSuccess, saved, setReducedMotion]);
}
