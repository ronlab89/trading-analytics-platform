import { useEffect, useState } from "react";

export const REPLAY_SPEEDS = [0.5, 1, 2] as const;
export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number];
export type ReplayStatus = "paused" | "playing" | "finished";

/** How long one event stays on screen at 1×. */
const STEP_MS = 1500;

/**
 * Where the replay of a decision stands: which event it is on, whether it is playing and how fast.
 * It opens on the last event, the decision as it stands, and playing from there starts over from the
 * first one. Going to the previous or the next event pauses, so that event can be read. It only
 * moves a position: the history itself is never touched.
 */
export function useReplayPlayer(eventCount: number) {
  const last = eventCount - 1;
  const [position, setPosition] = useState(last);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState<ReplaySpeed>(1);

  const index = Math.min(position, last);
  const status: ReplayStatus = index === last ? "finished" : running ? "playing" : "paused";

  useEffect(() => {
    if (status !== "playing") return undefined;

    const timer = setTimeout(() => {
      setPosition(index + 1);
      if (index + 1 === last) setRunning(false);
    }, STEP_MS / speed);

    return () => {
      clearTimeout(timer);
    };
  }, [status, index, last, speed]);

  const stepTo = (target: number) => {
    setRunning(false);
    setPosition(target);
  };

  const canGoPrevious = index > 0;
  const canGoNext = index < last;

  return {
    index,
    status,
    speed,
    setSpeed,
    canGoPrevious,
    canGoNext,
    previous: () => {
      if (canGoPrevious) stepTo(index - 1);
    },
    next: () => {
      if (canGoNext) stepTo(index + 1);
    },
    toggle: () => {
      if (status === "finished") {
        if (last > 0) {
          setPosition(0);
          setRunning(true);
        }
        return;
      }
      setRunning(status === "paused");
    },
  };
}

export type ReplayPlayer = ReturnType<typeof useReplayPlayer>;
