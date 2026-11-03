import { Popover as PopoverPrimitive } from "radix-ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DateRangeCalendar } from "@/features/transactions/components/date-range-calendar";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import type { PerformancePeriod } from "@/features/dashboard/hooks/use-performance";
import type { AnalyticsPeriod } from "../lib/analytics-period";

/** The presets of the Figma selector (1S · 1M · 3M · 6M · 1A). The API has no `1D` for analytics. */
export const ANALYTICS_PERIODS = [
  "1W",
  "1M",
  "3M",
  "6M",
  "1Y",
] as const satisfies readonly PerformancePeriod[];

interface AnalyticsPeriodSelectorProps {
  value: AnalyticsPeriod;
  onChange: (period: AnalyticsPeriod) => void;
  /** The day "today" means for the calendar; a test fixes it. */
  today?: Date | undefined;
}

const BUTTON =
  "h-8 rounded-sm px-3 text-sm font-medium text-(--color-text-secondary) outline-none hover:text-(--color-text-default) focus-visible:ring-2 focus-visible:ring-(--color-brand-brand)";
const PRESSED = "bg-(--color-button-primary-background) text-(--color-button-primary-foreground)";

/**
 * The period selector of the Figma "Análisis": 1S, 1M, 3M, 6M and 1A, and "Personalizado", which
 * opens the range calendar under it. One period is pressed at a time; "Personalizado" is pressed
 * once a custom range is in force. The calendar shows two months from the desktop width and one
 * below it, and nothing leaves it until "Aplicar".
 */
export function AnalyticsPeriodSelector({ value, onChange, today }: AnalyticsPeriodSelectorProps) {
  const { t } = useTranslation();
  const isDesktop = useMediaQuery("(min-width: 901px)");
  const [open, setOpen] = useState(false);

  return (
    <div
      aria-label={t("analytics.period.label")}
      className="flex max-w-full gap-0.5 overflow-x-auto rounded-md bg-(--color-surface-secondary) p-0.5"
      role="group"
    >
      {ANALYTICS_PERIODS.map((period) => {
        const pressed = value.kind === "preset" && value.period === period;
        return (
          <button
            aria-pressed={pressed}
            className={cn(BUTTON, pressed && PRESSED)}
            key={period}
            onClick={() => {
              onChange({ kind: "preset", period });
            }}
            type="button"
          >
            {t(`analytics.period.presets.${period}`)}
          </button>
        );
      })}
      <PopoverPrimitive.Root onOpenChange={setOpen} open={open}>
        <PopoverPrimitive.Trigger asChild>
          <button
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-pressed={value.kind === "custom"}
            className={cn(BUTTON, "whitespace-nowrap", value.kind === "custom" && PRESSED)}
            type="button"
          >
            {t("analytics.period.custom")}
          </button>
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align="end"
            className="z-50 max-h-(--radix-popover-content-available-height) max-w-[calc(100vw-1rem)] overflow-y-auto rounded-xl border border-(--color-border-default) bg-(--color-surface-card) shadow-dialog outline-hidden"
            collisionPadding={8}
            sideOffset={8}
          >
            <DateRangeCalendar
              months={isDesktop ? 2 : 1}
              onApply={(range) => {
                onChange({ kind: "custom", ...range });
                setOpen(false);
              }}
              onCancel={() => {
                setOpen(false);
              }}
              today={today}
              value={value.kind === "custom" ? { from: value.from, to: value.to } : null}
            />
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </div>
  );
}
