import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { useFieldControlProps } from "./field-context";

/**
 * What the text controls of the Figma share (Input and Textarea): the border, the background and
 * their hover, focus, error and disabled states, all from the `--color-input-*` tokens. The focus
 * ring is the 2 px outline Figma draws 3 px outside.
 */
export const inputControlClasses =
  "w-full rounded-md border border-(--color-input-border) outline-0 bg-(--color-input-background) text-(--color-text-default) transition-colors placeholder:text-(--color-text-secondary) hover:border-(--color-input-border-hover) keyboard:focus-visible:border-(--color-input-border-hover) keyboard:focus-visible:outline-2 keyboard:focus-visible:outline-offset-3 keyboard:focus-visible:outline-(--color-input-ring) aria-invalid:border-(--color-input-border-error) keyboard:aria-invalid:focus-visible:outline-(--color-input-ring-error) disabled:cursor-not-allowed disabled:border-(--color-input-border-disabled) disabled:bg-(--color-input-background-disabled) disabled:text-(--color-text-disabled) disabled:placeholder:text-(--color-text-disabled)";

/**
 * The Figma "Editing" state of the Input and the Textarea: while a pointer has the focus, the
 * border turns dark and 2 px thick. Figma draws that stroke inside the box, so the second pixel is
 * an inset shadow and the content does not move. Keyboard focus keeps its ring instead, and an
 * invalid field keeps its error border. The Select does not take it: its Figma has no such state.
 */
export const inputEditingClasses =
  "pointer:focus:not-aria-invalid:border-(--color-input-border-editing) pointer:focus:not-aria-invalid:shadow-[inset_0_0_0_1px_var(--color-input-border-editing)]";

/** The Figma "Input": three sizes (32, 36 and 40 px). */
const inputVariants = cva(inputControlClasses, {
  variants: {
    size: {
      sm: "h-8 px-3 text-sm",
      md: "h-9 px-3 text-sm",
      lg: "h-10 px-4 text-base",
    },
  },
  defaultVariants: { size: "md" },
});

type InputProps = Omit<ComponentProps<"input">, "size"> & VariantProps<typeof inputVariants>;

function Input({ className, size, ...props }: InputProps) {
  const control = useFieldControlProps(props);

  return (
    <input
      className={cn(inputVariants({ size }), inputEditingClasses, className)}
      data-slot="input"
      {...props}
      {...control}
    />
  );
}

export { Input, inputVariants };
