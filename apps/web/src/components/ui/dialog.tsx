import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "./button";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

/**
 * The Figma "Dialog" panel: 400 px wide (`sm`) or 520 px (`md`), centered, with a 12 px radius and
 * the dialog shadow. On a narrow screen it keeps a 16 px margin on each side instead. With
 * `mobileSheet`, the Figma mobile form: below the tablet width it becomes a sheet at the bottom of
 * the screen, 120 px from the top, with 16 px top corners and a grabber.
 */
const dialogContentVariants = cva(
  "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl bg-(--color-surface-card) shadow-dialog outline-hidden duration-200 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
  {
    variants: {
      size: { sm: "max-w-100", md: "max-w-130" },
      mobileSheet: {
        true: "max-tablet:inset-x-0 max-tablet:top-30 max-tablet:bottom-0 max-tablet:max-h-none max-tablet:w-full max-tablet:max-w-none max-tablet:translate-x-0 max-tablet:translate-y-0 max-tablet:rounded-t-2xl max-tablet:rounded-b-none max-tablet:data-open:zoom-in-100 max-tablet:data-open:slide-in-from-bottom-full max-tablet:data-closed:zoom-out-100 max-tablet:data-closed:slide-out-to-bottom-full",
        false: "",
      },
    },
    defaultVariants: { size: "sm", mobileSheet: false },
  },
);

type DialogContentProps = ComponentProps<typeof DialogPrimitive.Content> &
  VariantProps<typeof dialogContentVariants>;

/**
 * The panel over a dimmed page. A dialog without a `DialogDescription` passes
 * `aria-describedby={undefined}`, as Radix asks.
 */
function DialogContent({ className, size, mobileSheet, children, ...props }: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className="fixed inset-0 z-50 bg-(--color-surface-overlay) duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        data-slot="dialog-overlay"
      />
      <DialogPrimitive.Content
        className={cn(dialogContentVariants({ size, mobileSheet }), className)}
        data-mobile-sheet={mobileSheet ? "" : undefined}
        data-slot="dialog-content"
        {...props}
      >
        {mobileSheet ? (
          <div
            aria-hidden="true"
            className="flex justify-center pt-1 pb-3 tablet:hidden"
            data-slot="dialog-grabber"
          >
            <div className="h-1 w-9 rounded-xs bg-(--color-border-strong)" />
          </div>
        ) : null}
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** Title and description on the left, the close button on the right. */
function DialogHeader({ className, children, ...props }: ComponentProps<"div">) {
  const { t } = useTranslation();

  return (
    <div
      className={cn("flex items-start gap-2 px-6 pt-6", className)}
      data-slot="dialog-header"
      {...props}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">{children}</div>
      <DialogPrimitive.Close asChild>
        <Button aria-label={t("dialog.close")} size="icon-sm" variant="ghost">
          <X aria-hidden="true" />
        </Button>
      </DialogPrimitive.Close>
    </div>
  );
}

function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("text-lg leading-7 font-semibold text-(--color-text-default)", className)}
      data-slot="dialog-title"
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-sm leading-5 text-(--color-text-secondary)", className)}
      data-slot="dialog-description"
      {...props}
    />
  );
}

/**
 * What the dialog is about: a form, or the text of a confirmation. It scrolls if it grows. In the
 * mobile sheet the form has 16 px at the sides, as in the Figma.
 */
function DialogBody({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col gap-2 overflow-y-auto px-6 pt-4 pb-6 in-data-mobile-sheet:max-tablet:flex-1 in-data-mobile-sheet:max-tablet:px-4",
        className,
      )}
      data-slot="dialog-body"
      {...props}
    />
  );
}

/**
 * The actions, right-aligned under a line. In the mobile sheet the two buttons share the width;
 * in a confirmation they keep their own width, as in the Figma.
 */
function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 border-t border-(--color-border-default) p-6 in-data-mobile-sheet:max-tablet:*:flex-1",
        className,
      )}
      data-slot="dialog-footer"
      {...props}
    />
  );
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
};
