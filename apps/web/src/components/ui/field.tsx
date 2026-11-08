import { CircleAlert } from "lucide-react";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FieldContext } from "./field-context";

interface FieldProps {
  label: ReactNode;
  /** Help text; the error replaces it while there is one. */
  description?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  /** The control: it takes its id, description, invalid, required and disabled from here. */
  children: ReactNode;
}

/**
 * The Figma "Field", vertical: label, control, then the help text or the error. The label
 * and the control are tied by id, and the control is described by whichever text shows.
 */
function Field({
  label,
  description,
  error,
  required = false,
  disabled = false,
  className,
  children,
}: FieldProps) {
  const id = useId();
  const controlId = `${id}-control`;
  const messageId = `${id}-message`;
  const hasError = Boolean(error);
  const hasMessage = hasError || Boolean(description);

  return (
    <FieldContext
      value={{
        controlId,
        describedBy: hasMessage ? messageId : undefined,
        invalid: hasError,
        required,
        disabled,
      }}
    >
      <div className={cn("flex flex-col gap-2", className)} data-slot="field">
        <label
          className={cn(
            "flex items-center gap-1 text-sm leading-5 font-medium text-(--color-text-default)",
            disabled && "text-(--color-text-disabled)",
          )}
          htmlFor={controlId}
        >
          {label}
          {required ? (
            <span
              aria-hidden="true"
              className={disabled ? "text-(--color-text-disabled)" : "text-(--color-status-error)"}
            >
              *
            </span>
          ) : null}
        </label>
        {children}
        {hasError ? (
          <p className="flex items-start gap-1 text-xs text-(--color-status-error)" id={messageId}>
            <CircleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
            {error}
          </p>
        ) : null}
        {!hasError && description ? (
          <p
            className={cn(
              "text-xs text-(--color-text-secondary)",
              disabled && "text-(--color-text-disabled)",
            )}
            id={messageId}
          >
            {description}
          </p>
        ) : null}
      </div>
    </FieldContext>
  );
}

export { Field };
