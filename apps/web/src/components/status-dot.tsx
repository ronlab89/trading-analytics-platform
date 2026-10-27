import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusDot = cva("inline-block shrink-0 rounded-full", {
  variants: {
    tone: {
      neutral: "bg-(--color-text-disabled)",
      success: "bg-(--color-status-success)",
      warning: "bg-(--color-status-warning-solid)",
      error: "bg-(--color-status-error)",
      brand: "bg-(--color-brand-brand)",
    },
    size: {
      sm: "size-1.5",
      md: "size-2",
    },
  },
  defaultVariants: { tone: "neutral", size: "sm" },
});

type StatusDotProps = VariantProps<typeof statusDot> & { className?: string };

/** The Figma "Status dot": decorative, the text next to it states the status (never color alone). */
export function StatusDot({ tone, size, className }: StatusDotProps) {
  return <span aria-hidden="true" className={cn(statusDot({ tone, size }), className)} />;
}
