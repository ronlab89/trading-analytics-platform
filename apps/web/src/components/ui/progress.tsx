import { cn } from "@/lib/utils";

interface ProgressProps {
  /** What is progressing, read by assistive technology. */
  label: string;
  /** How much is done, from 0 to `max`. `null` when it is not known yet: the bar then pulses. */
  value: number | null;
  max: number;
  className?: string | undefined;
}

/**
 * A bar that fills as work advances. The fill is clamped between empty and full, so a count that
 * overshoots or a total still at zero never draws outside the track. Without a value it is
 * indeterminate: no `aria-valuenow`, and the pulse stops for those who ask for less motion.
 */
export function Progress({ label, value, max, className }: ProgressProps) {
  const percent = value === null || max <= 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div
      aria-label={label}
      aria-valuemax={max}
      aria-valuemin={0}
      {...(value === null ? {} : { "aria-valuenow": Math.min(max, Math.max(0, value)) })}
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-(--color-border-default)",
        className,
      )}
      role="progressbar"
    >
      <div
        className={cn(
          "h-full rounded-full bg-(--color-button-primary-background) transition-[width] duration-300 motion-reduce:transition-none",
          value === null && "w-1/3 animate-pulse motion-reduce:animate-none",
        )}
        data-testid="progress-fill"
        style={value === null ? undefined : { width: `${String(percent)}%` }}
      />
    </div>
  );
}
