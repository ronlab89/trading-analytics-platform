import { createContext, use } from "react";

/** What a `Field` tells the control inside it, so the two stay wired without props drilling. */
interface FieldContextValue {
  controlId: string;
  /** The ids of the help text or the error that describes the control. */
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
  disabled: boolean;
}

export const FieldContext = createContext<FieldContextValue | undefined>(undefined);

interface ControlProps {
  id?: string | undefined;
  disabled?: boolean | undefined;
  required?: boolean | undefined;
  "aria-invalid"?: boolean | "true" | "false" | "grammar" | "spelling" | undefined;
  "aria-describedby"?: string | undefined;
}

/**
 * The accessibility props a control takes from its `Field`. The id is always the field's, or
 * its label would stop pointing at the control; the other props keep what the control sets
 * itself, and a description it brings is kept next to the field's own.
 */
export function useFieldControlProps(own: ControlProps): ControlProps {
  const field = use(FieldContext);
  if (!field) {
    return own;
  }
  const describedBy = [own["aria-describedby"], field.describedBy].filter(Boolean).join(" ");
  return {
    id: field.controlId,
    disabled: own.disabled ?? (field.disabled || undefined),
    required: own.required ?? (field.required || undefined),
    "aria-invalid": own["aria-invalid"] ?? (field.invalid || undefined),
    "aria-describedby": describedBy || undefined,
  };
}
