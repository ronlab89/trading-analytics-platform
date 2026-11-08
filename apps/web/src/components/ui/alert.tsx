import { cva, type VariantProps } from "class-variance-authority";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The Figma "Alert": four tones, each with its muted background and its icon color. */
const alertVariants = cva("flex items-start gap-3 rounded-md px-3 py-2", {
  variants: {
    tone: {
      info: "bg-(--color-status-info-muted)",
      success: "bg-(--color-status-success-muted)",
      warning: "bg-(--color-status-warning-muted)",
      error: "bg-(--color-status-error-muted)",
    },
  },
  defaultVariants: { tone: "info" },
});

const toneIcon = {
  info: { Icon: Info, className: "text-(--color-status-info)" },
  success: { Icon: CircleCheck, className: "text-(--color-status-success)" },
  warning: { Icon: TriangleAlert, className: "text-(--color-status-warning)" },
  error: { Icon: CircleAlert, className: "text-(--color-status-error)" },
} as const;

type AlertTone = NonNullable<VariantProps<typeof alertVariants>["tone"]>;

type AlertProps = Omit<ComponentProps<"div">, "title"> & {
  tone: AlertTone;
  title: ReactNode;
  description?: ReactNode;
  /** Sits at the right, aligned to the top: a small outline `Button`, for example. */
  action?: ReactNode;
};

/**
 * An error is announced as soon as it appears; the other tones wait for the screen reader to
 * finish. The caller can override the role, for a warning that must interrupt.
 */
function Alert({ tone, title, description, action, className, role, ...props }: AlertProps) {
  const { Icon, className: iconClassName } = toneIcon[tone];

  return (
    <div
      className={cn(alertVariants({ tone }), className)}
      data-slot="alert"
      role={role ?? (tone === "error" ? "alert" : "status")}
      {...props}
    >
      <div className="pt-0.5">
        <Icon aria-hidden="true" className={cn("size-4", iconClassName)} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm leading-5">
        <p className="font-medium text-(--color-text-default)">{title}</p>
        {description ? <p className="text-(--color-text-secondary)">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export { Alert, alertVariants };
