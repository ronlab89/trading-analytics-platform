import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { useFieldControlProps } from "./field-context";
import { Input } from "./input";

type PasswordInputProps = Omit<ComponentProps<typeof Input>, "type"> & {
  /** What the toggle says while the password is hidden, already translated. */
  showLabel: string;
  /** What the toggle says while the password is shown, already translated. */
  hideLabel: string;
};

/** Room for the toggle: the input's padding, the 16 px icon and the 8 px gap Figma leaves. */
const toggleClearance = { sm: "pr-9", md: "pr-9", lg: "pr-10" } as const;
/** The 24 px target is centered on the Figma icon, 12 px (16 px on `lg`) from the border. */
const toggleOffset = { sm: "right-2", md: "right-2", lg: "right-3" } as const;

/** The Figma "Input" with the eye at its right edge. The toggle is a button, not part of the value. */
function PasswordInput({
  className,
  size = "md",
  showLabel,
  hideLabel,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const { id, disabled } = useFieldControlProps(props);
  const Icon = visible ? EyeOff : Eye;

  return (
    <div className="relative" data-slot="password-input">
      <Input
        className={cn(toggleClearance[size ?? "md"], className)}
        size={size}
        type={visible ? "text" : "password"}
        {...props}
      />
      <button
        aria-controls={id}
        aria-label={visible ? hideLabel : showLabel}
        className={cn(
          "absolute top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-(--color-text-secondary) transition-colors hover:text-(--color-text-default) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-input-ring) disabled:pointer-events-none disabled:text-(--color-text-disabled)",
          toggleOffset[size ?? "md"],
        )}
        disabled={disabled}
        onClick={() => {
          setVisible((current) => !current);
        }}
        type="button"
      >
        <Icon aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

export { PasswordInput };
