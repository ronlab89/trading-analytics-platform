import { useEffect, useState } from "react";
import { useBlocker } from "react-router";

interface UnsavedChangesGuard {
  /** A way out is waiting for the user's answer, so the confirmation shows. */
  asking: boolean;
  /** Goes where the user was going: a section of Settings, or another page. */
  leave: () => void;
  /** Stays: the way out is dropped and the form is as it was. */
  stay: () => void;
  /** Takes a way out of Settings itself (a section); true when it went on, false when it asks first. */
  guard: (proceed: () => void) => boolean;
}

/**
 * Stops the user from losing what they changed. A move to another section goes through `guard`; a
 * move to another page is blocked by the router; and a reload or a closed tab gets the browser's own
 * warning. Changing only the section in the address is not leaving, so the router lets it pass.
 */
export function useUnsavedChangesGuard(dirty: boolean): UnsavedChangesGuard {
  const [pending, setPending] = useState<(() => void) | null>(null);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
    };
  }, [dirty]);

  return {
    asking: pending !== null || blocker.state === "blocked",
    leave: () => {
      if (pending !== null) {
        const proceed = pending;
        setPending(null);
        proceed();
      } else if (blocker.state === "blocked") {
        blocker.proceed();
      }
    },
    stay: () => {
      setPending(null);
      if (blocker.state === "blocked") blocker.reset();
    },
    guard: (proceed) => {
      if (!dirty) {
        proceed();
        return true;
      }
      setPending(() => proceed);
      return false;
    },
  };
}
