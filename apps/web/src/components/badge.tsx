import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const badge = cva("inline-flex items-center gap-1 rounded-md text-xs font-semibold", {
  variants: {
    style: {
      subtle:
        "bg-(--color-badge-neutral-subtle-background) text-(--color-badge-neutral-subtle-foreground)",
      solid:
        "bg-(--color-badge-neutral-solid-background) text-(--color-badge-neutral-solid-foreground)",
    },
    size: { sm: "px-2 py-0.5", md: "px-2 py-1" },
  },
  defaultVariants: { style: "subtle", size: "sm" },
});

type BadgeProps = VariantProps<typeof badge> & { className?: string; children: ReactNode };

/** The Figma "Badge", neutral tone only; the other tones arrive with the screens that use them. */
export function Badge({ style, size, className, children }: BadgeProps) {
  return <span className={cn(badge({ style, size }), className)}>{children}</span>;
}
