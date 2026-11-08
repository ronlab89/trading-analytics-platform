import { cn } from "@/lib/utils";

/**
 * The Figma "Skeleton": a block that holds the place of content that is loading. It is decorative;
 * the region that holds it says what is loading (a `status` with a label), and the pulse stops for
 * those who ask for less motion.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block animate-pulse rounded-md bg-(--color-surface-skeleton) motion-reduce:animate-none",
        className,
      )}
    />
  );
}
