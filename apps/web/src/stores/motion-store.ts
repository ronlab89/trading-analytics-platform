import { create } from "zustand";

interface MotionState {
  /** The user asked for reduced motion in Settings. The system setting is read apart, in the media query. */
  reducedMotion: boolean;
  setReducedMotion: (reducedMotion: boolean) => void;
}

/** Owns the reduced-motion preference of the user, so the charts need no API client to read it. */
export const useMotionStore = create<MotionState>((set) => ({
  reducedMotion: false,
  setReducedMotion: (reducedMotion) => {
    set({ reducedMotion });
  },
}));
