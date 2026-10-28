import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import type { ComponentProps } from "react";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * The Figma "Button" and "Icon Button": five variants, three sizes (32, 36 and 40 px) and
 * the square `icon-*` sizes. States come from the `--color-button-*` tokens.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors select-none focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-(--color-button-focus-ring) disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary:
          "bg-(--color-button-primary-background) text-(--color-button-primary-foreground) hover:bg-(--color-button-primary-background-hover) active:bg-(--color-button-primary-background-pressed) disabled:bg-(--color-button-disabled-background) disabled:text-(--color-button-disabled-foreground)",
        outline:
          "border border-(--color-button-outline-border) text-(--color-button-outline-foreground) hover:border-(--color-button-outline-border-hover) hover:bg-(--color-button-outline-background-hover) active:bg-(--color-button-outline-background-pressed) disabled:border-(--color-button-disabled-border) disabled:text-(--color-button-disabled-foreground)",
        ghost:
          "text-(--color-button-ghost-foreground) hover:bg-(--color-button-ghost-background-hover) active:bg-(--color-button-ghost-background-pressed) disabled:text-(--color-button-disabled-foreground)",
        link: "text-(--color-button-link-foreground) underline-offset-4 hover:underline active:text-(--color-button-link-foreground-pressed) disabled:text-(--color-button-disabled-foreground)",
        destructive:
          "bg-(--color-button-destructive-background) text-(--color-button-destructive-foreground) hover:bg-(--color-button-destructive-background-hover) active:bg-(--color-button-destructive-background-pressed) disabled:bg-(--color-button-disabled-background) disabled:text-(--color-button-disabled-foreground)",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-9 px-4",
        lg: "h-10 px-6 text-base",
        "icon-sm": "size-8",
        "icon-md": "size-9",
        "icon-lg": "size-10",
      },
    },
    compoundVariants: [{ variant: "link", class: "h-auto px-0" }],
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Shows the spinner and ignores clicks while an action runs; it keeps its normal colors. */
    loading?: boolean;
  };

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  children,
  onClick,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);

  if (asChild) {
    return (
      <Slot.Root className={classes} data-slot="button" {...props}>
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      aria-busy={loading || undefined}
      className={cn(classes, loading && "pointer-events-none")}
      data-slot="button"
      onClick={
        loading
          ? (event) => {
              event.preventDefault();
            }
          : onClick
      }
      {...props}
    >
      {loading ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
      {children}
    </button>
  );
}

export { Button, buttonVariants };
