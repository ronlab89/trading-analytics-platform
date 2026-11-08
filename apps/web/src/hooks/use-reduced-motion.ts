import { useMotionStore } from "@/stores/motion-store";
import { useMediaQuery } from "./use-media-query";

/** Whether to hold the animations: the user chose it in Settings, or the system asks for it. */
export function useReducedMotion(): boolean {
  const chosen = useMotionStore((state) => state.reducedMotion);
  const asked = useMediaQuery("(prefers-reduced-motion: reduce)");
  return chosen || asked;
}
