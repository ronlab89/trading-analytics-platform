import { Dialog as SheetPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "cn";

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetTitle = SheetPrimitive.Title;

/** A panel that slides up from the bottom edge, over a dimmed page (the Figma mobile "Sheet"). */
function SheetContent({
  className,
  children,
  ...props
}: ComponentProps<typeof SheetPrimitive.Content>) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-(--color-surface-overlay) duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
      <SheetPrimitive.Content
        aria-describedby={undefined}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t bg-card px-2 pt-2 pb-6 outline-hidden duration-200 data-open:animate-in data-open:slide-in-from-bottom data-closed:animate-out data-closed:slide-out-to-bottom",
          className,
        )}
        {...props}
      >
        <div aria-hidden="true" className="flex justify-center pt-1 pb-3">
          <div className="h-1 w-9 rounded-xs bg-(--color-border-strong)" />
        </div>
        {children}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

export { Sheet, SheetContent, SheetTitle, SheetTrigger };
