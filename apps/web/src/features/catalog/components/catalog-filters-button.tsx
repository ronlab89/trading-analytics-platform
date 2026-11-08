import { SlidersHorizontal } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-media-query";
import { activeCatalogFilterCount, type CatalogFilters } from "../lib/catalog-filters";
import { CatalogFiltersForm } from "./catalog-filters-form";

interface CatalogFiltersButtonProps {
  /** The filters in force. */
  value: CatalogFilters;
  onApply: (filters: CatalogFilters) => void;
  /** Waits disabled, while the first page is still loading. */
  disabled?: boolean;
}

/**
 * The Figma "Filtros" button and what it opens: a panel under it from the tablet width up, and the
 * bottom sheet on mobile. The button says how many filters narrow the list ("Filtros · 1"). The
 * form is mounted only while it is open, so every opening starts from the filters in force.
 */
export function CatalogFiltersButton({
  value,
  onApply,
  disabled = false,
}: CatalogFiltersButtonProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const count = activeCatalogFilterCount(value);

  const trigger = (
    <Button disabled={disabled} variant="ghost">
      <SlidersHorizontal aria-hidden="true" />
      {count > 0 ? t("catalogFilters.triggerCount", { count }) : t("catalogFilters.trigger")}
    </Button>
  );
  const apply = (filters: CatalogFilters) => {
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
        {/* The Figma sheet hugs its content, pinned to the bottom, instead of filling the screen. */}
        <DialogContent
          aria-describedby={undefined}
          className="max-tablet:top-auto max-tablet:max-h-[calc(100%-7.5rem)]"
          mobileSheet
        >
          <DialogTitle className="sr-only">{t("catalogFilters.title")}</DialogTitle>
          <CatalogFiltersForm layout="sheet" onApply={apply} onCancel={close} value={value} />
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
          aria-label={t("catalogFilters.title")}
          className="z-50 w-100 max-w-[calc(100vw-1rem)] rounded-xl border border-(--color-border-default) bg-(--color-surface-card) shadow-dialog outline-hidden"
          collisionPadding={8}
          sideOffset={8}
        >
          <CatalogFiltersForm onApply={apply} onCancel={close} value={value} />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
