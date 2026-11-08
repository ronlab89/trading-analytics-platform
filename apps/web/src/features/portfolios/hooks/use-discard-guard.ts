import { useEffect, useState } from "react";

interface UseDiscardGuardOptions {
  /** A request is in flight: the dialog cannot be dismissed until it answers. */
  locked: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * What a portfolio form dialog needs to ask "¿Salir sin guardar?" before it loses what the user
 * typed. Hand `handleOpenChange` to the `Dialog`: a dismissal with changes opens the confirmation
 * instead of closing, and one without changes, or while `locked`, behaves as the dialog always
 * did. The form reports its changes through `setDirty`; `close` is for a success or a confirmed
 * discard.
 */
export function useDiscardGuard({ locked, onOpenChange }: UseDiscardGuardOptions) {
  const [dirty, setDirty] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const close = () => {
    setConfirmingDiscard(false);
    onOpenChange(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (locked) {
      return;
    }
    if (next) {
      onOpenChange(true);
    } else if (dirty) {
      setConfirmingDiscard(true);
    } else {
      close();
    }
  };

  const keepEditing = () => {
    setConfirmingDiscard(false);
  };

  return { setDirty, confirmingDiscard, handleOpenChange, close, keepEditing };
}

/**
 * The form's side of `useDiscardGuard`: reports whether it has changes, and that it has none once
 * it unmounts, so a dialog closed from outside does not carry the state to its next opening.
 */
export function useReportDirty(isDirty: boolean, setDirty: (dirty: boolean) => void) {
  useEffect(() => {
    setDirty(isDirty);
  }, [isDirty, setDirty]);
  useEffect(() => {
    return () => {
      setDirty(false);
    };
  }, [setDirty]);
}
