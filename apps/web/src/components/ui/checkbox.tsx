import { Check, Minus } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The Figma "Checkbox": a 16 px box in three values (unchecked, checked, indeterminate) and the
 * default, focus, error and disabled states, all from the `--color-checkbox-*` tokens. Radix
 * keeps the keyboard, the `mixed` announcement and the form value. The checked and indeterminate
 * classes are written twice on purpose: Tailwind only finds whole class names.
 */
function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "group size-4 shrink-0 rounded-sm border border-(--color-checkbox-border) bg-(--color-checkbox-background) transition-colors hover:border-(--color-checkbox-border-hover) focus-visible:border-(--color-checkbox-border-hover) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-checkbox-ring) data-[state=checked]:border-(--color-checkbox-background-checked) data-[state=checked]:bg-(--color-checkbox-background-checked) data-[state=checked]:hover:border-(--color-checkbox-background-checked-hover) data-[state=checked]:hover:bg-(--color-checkbox-background-checked-hover) data-[state=indeterminate]:border-(--color-checkbox-background-checked) data-[state=indeterminate]:bg-(--color-checkbox-background-checked) data-[state=indeterminate]:hover:border-(--color-checkbox-background-checked-hover) data-[state=indeterminate]:hover:bg-(--color-checkbox-background-checked-hover) aria-invalid:border-(--color-checkbox-border-error) aria-invalid:hover:border-(--color-checkbox-border-error) aria-invalid:focus-visible:border-(--color-checkbox-border-error) aria-invalid:focus-visible:outline-(--color-checkbox-ring-error) aria-invalid:data-[state=checked]:border-(--color-checkbox-border-error) aria-invalid:data-[state=checked]:bg-(--color-checkbox-background-checked-error) aria-invalid:data-[state=indeterminate]:border-(--color-checkbox-border-error) aria-invalid:data-[state=indeterminate]:bg-(--color-checkbox-background-checked-error) disabled:pointer-events-none disabled:border-(--color-checkbox-border-disabled) disabled:bg-(--color-checkbox-background-disabled) disabled:data-[state=checked]:border-(--color-checkbox-border-disabled) disabled:data-[state=checked]:bg-(--color-checkbox-background-checked-disabled) disabled:data-[state=indeterminate]:border-(--color-checkbox-border-disabled) disabled:data-[state=indeterminate]:bg-(--color-checkbox-background-checked-disabled)",
        className,
      )}
      data-slot="checkbox"
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className="flex items-center justify-center text-(--color-text-on-primary)"
        data-slot="checkbox-indicator"
      >
        <Check
          nonScalingStroke
          aria-hidden="true"
          className="size-3 group-data-[state=indeterminate]:hidden"
          strokeWidth={1.33}
        />
        <Minus
          nonScalingStroke
          aria-hidden="true"
          className="hidden size-3 group-data-[state=indeterminate]:block"
          strokeWidth={1.33}
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

type CheckboxItemProps = Omit<ComponentProps<typeof Checkbox>, "children"> & {
  label: ReactNode;
  /** Help text under the label. */
  description?: ReactNode;
};

/** The Figma "Checkbox item": the box with its label at the right and an optional help text. */
function CheckboxItem({
  label,
  description,
  className,
  id,
  disabled,
  "aria-describedby": describedBy,
  ...props
}: CheckboxItemProps) {
  const generatedId = useId();
  const controlId = id ?? `${generatedId}-control`;
  const descriptionId = `${generatedId}-description`;
  const allDescribedBy = [describedBy, description ? descriptionId : undefined]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cn("flex items-start gap-2", className)} data-slot="checkbox-item">
      <Checkbox
        aria-describedby={allDescribedBy || undefined}
        className="mt-0.5"
        disabled={disabled}
        id={controlId}
        {...props}
      />
      <div className="flex flex-col">
        <label
          className={cn(
            "cursor-pointer text-sm leading-5 text-(--color-text-default)",
            disabled && "cursor-not-allowed text-(--color-text-disabled)",
          )}
          htmlFor={controlId}
        >
          {label}
        </label>
        {description ? (
          <p
            className={cn(
              "text-xs leading-4 text-(--color-text-secondary)",
              disabled && "text-(--color-text-disabled)",
            )}
            id={descriptionId}
          >
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export { Checkbox, CheckboxItem };
