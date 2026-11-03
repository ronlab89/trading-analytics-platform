import { Popover as PopoverPrimitive } from "radix-ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { PerformancePeriod } from "@/features/dashboard/hooks/use-performance";
import { DateRangeCalendar } from "@/features/transactions/components/date-range-calendar";
import { useIsMobile, useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
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
  "h-8 shrink-0 rounded-sm px-3 text-sm font-medium whitespace-nowrap text-(--color-text-secondary) outline-none hover:text-(--color-text-default) focus-visible:ring-2 focus-visible:ring-(--color-brand-brand) max-tablet:flex-1";
const PRESSED = "bg-(--color-button-primary-background) text-(--color-button-primary-foreground)";

/**
 * The period selector of the Figma "Análisis": 1S, 1M, 3M, 6M and 1A, and "Personalizado", which
 * opens the range calendar. One period is pressed at a time; "Personalizado" is pressed once a
 * custom range is in force. Nothing leaves the calendar until "Aplicar". From the tablet width it
 * is a panel under the button, with two months from the desktop width; on a phone it is the
 * bottom sheet "Elegir período", with a single month and no presets, and the selector takes the
 * whole width and scrolls if it does not fit.
 */
export function AnalyticsPeriodSelector({ value, onChange, today }: AnalyticsPeriodSelectorProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const isDesktop = useMediaQuery("(min-width: 901px)");
  const [open, setOpen] = useState(false);
  const custom = value.kind === "custom";

  const trigger = (
    <button
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-pressed={custom}
      className={cn(BUTTON, custom && PRESSED)}
      type="button"
    >
      {t("analytics.period.custom")}
    </button>
  );
  const calendar = (
    <DateRangeCalendar
      months={isDesktop ? 2 : 1}
      onApply={(range) => {
        onChange({ kind: "custom", ...range });
        setOpen(false);
      }}
      onCancel={() => {
        setOpen(false);
      }}
      presets={!isMobile}
      today={today}
      value={value.kind === "custom" ? { from: value.from, to: value.to } : null}
    />
  );

  return (
    <div
      aria-label={t("analytics.period.label")}
      className="flex max-w-full gap-0.5 overflow-x-auto rounded-md bg-(--color-surface-secondary) p-0.5 max-tablet:w-full"
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
      {isMobile ? (
        <Dialog onOpenChange={setOpen} open={open}>
          <DialogTrigger asChild>{trigger}</DialogTrigger>
          <DialogContent
            className="max-tablet:top-auto max-tablet:max-h-[calc(100%-7.5rem)]"
            mobileSheet
          >
            <DialogHeader>
              <DialogTitle>{t("analytics.period.sheetTitle")}</DialogTitle>
              <DialogDescription>{t("analytics.period.sheetDescription")}</DialogDescription>
            </DialogHeader>
            <div className="min-h-0 overflow-y-auto">{calendar}</div>
          </DialogContent>
        </Dialog>
      ) : (
        <PopoverPrimitive.Root onOpenChange={setOpen} open={open}>
          <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
          <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
              align="end"
              className="z-50 max-h-(--radix-popover-content-available-height) max-w-[calc(100vw-1rem)] overflow-y-auto rounded-xl border border-(--color-border-default) bg-(--color-surface-card) shadow-dialog outline-hidden"
              collisionPadding={8}
              sideOffset={8}
            >
              {calendar}
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
      )}
    </div>
  );
}
