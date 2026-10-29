import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const badge = cva("inline-flex items-center gap-1 rounded-md text-xs font-semibold", {
  variants: {
    style: { subtle: "", solid: "" },
    tone: { neutral: "", success: "" },
    size: { sm: "px-2 py-0.5", md: "px-2 py-1" },
  },
  compoundVariants: [
    {
      style: "subtle",
      tone: "neutral",
      className:
        "bg-(--color-badge-neutral-subtle-background) text-(--color-badge-neutral-subtle-foreground)",
    },
    {
      style: "solid",
      tone: "neutral",
      className:
        "bg-(--color-badge-neutral-solid-background) text-(--color-badge-neutral-solid-foreground)",
    },
    {
      style: "subtle",
      tone: "success",
      className:
        "bg-(--color-badge-success-subtle-background) text-(--color-badge-success-subtle-foreground)",
    },
    {
      style: "solid",
      tone: "success",
      className:
        "bg-(--color-badge-success-solid-background) text-(--color-badge-success-solid-foreground)",
    },
  ],
  defaultVariants: { style: "subtle", tone: "neutral", size: "sm" },
});

type BadgeProps = VariantProps<typeof badge> & { className?: string; children: ReactNode };

/** The Figma "Badge", neutral and success tones; the other tones arrive with the screens that use them. */
export function Badge({ style, tone, size, className, children }: BadgeProps) {
  return <span className={cn(badge({ style, tone, size }), className)}>{children}</span>;
}
