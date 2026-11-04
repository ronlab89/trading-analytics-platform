import { SlidersHorizontal } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useIsMobile, useMediaQuery } from "@/hooks/use-media-query";
import { activePanelFilterCount, type ActivityPanelFilters } from "../lib/activity-panel-filters";
import { ActivityFiltersForm } from "./activity-filters-form";

interface ActivityFiltersButtonProps {
  /** The filters in force. */
  value: ActivityPanelFilters;
  onApply: (filters: ActivityPanelFilters) => void;
  /** The day "today" means for the date presets; a test fixes it. */
  today?: Date | undefined;
}

/**
 * The Figma "Filtros" button and what it opens: a panel under it from the tablet width up, and the
 * bottom sheet on mobile. The button says how many filters narrow the list ("Filtros · 3"). The
 * form is mounted only while it is open, so every opening starts from the filters in force.
 */
export function ActivityFiltersButton({ value, onApply, today }: ActivityFiltersButtonProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const isDesktop = useMediaQuery("(min-width: 901px)");
  const [open, setOpen] = useState(false);
  const count = activePanelFilterCount(value);

  const trigger = (
    <Button variant="ghost">
      <SlidersHorizontal aria-hidden="true" />
      {count > 0 ? t("activityFilters.triggerCount", { count }) : t("activityFilters.trigger")}
    </Button>
  );
  const apply = (filters: ActivityPanelFilters) => {
    onApply(filters);
    setOpen(false);
  };
  const close = () => {
    setOpen(false);
  };

  if (isMobile) {
    return (
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent
          aria-describedby={undefined}
          className="max-tablet:top-auto max-tablet:max-h-[calc(100%-7.5rem)]"
          mobileSheet
        >
          <DialogTitle className="sr-only">{t("activityFilters.title")}</DialogTitle>
          <ActivityFiltersForm
            layout="sheet"
            months={1}
            onApply={apply}
            onCancel={close}
            today={today}
            value={value}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <PopoverPrimitive.Root onOpenChange={setOpen} open={open}>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          aria-label={t("activityFilters.title")}
          className="z-50 w-100 max-w-[calc(100vw-1rem)] rounded-xl border border-(--color-border-default) bg-(--color-surface-card) shadow-dialog outline-hidden"
          collisionPadding={8}
          sideOffset={8}
        >
          <ActivityFiltersForm
            months={isDesktop ? 2 : 1}
            onApply={apply}
            onCancel={close}
            today={today}
            value={value}
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
