import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { useFieldControlProps } from "./field-context";

/**
 * The Figma "Input": three sizes (32, 36 and 40 px). Hover, focus, error and disabled come from
 * the `--color-input-*` tokens; the focus ring is the 2 px outline Figma draws 3 px outside.
 */
const inputVariants = cva(
  "w-full rounded-md border border-(--color-input-border) bg-(--color-input-background) text-(--color-text-default) transition-colors placeholder:text-(--color-text-secondary) hover:border-(--color-input-border-hover) focus-visible:border-(--color-input-border-hover) focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-(--color-input-ring) aria-invalid:border-(--color-input-border-error) aria-invalid:focus-visible:outline-(--color-input-ring-error) disabled:cursor-not-allowed disabled:border-(--color-input-border-disabled) disabled:bg-(--color-input-background-disabled) disabled:text-(--color-text-disabled) disabled:placeholder:text-(--color-text-disabled)",
  {
    variants: {
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-9 px-3 text-sm",
        lg: "h-10 px-4 text-base",
      },
    },
    defaultVariants: { size: "md" },
  },
);

type InputProps = Omit<ComponentProps<"input">, "size"> & VariantProps<typeof inputVariants>;

function Input({ className, size, ...props }: InputProps) {
  const control = useFieldControlProps(props);

  return (
    <input
      className={cn(inputVariants({ size }), className)}
      data-slot="input"
      {...props}
      {...control}
    />
  );
}

export { Input, inputVariants };
