import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert } from "lucide-react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * The shadcn "Sonner" toaster on the project tokens: one place for the transient messages
 * (`11-ui-ux-spec.md` §33). The app has a light theme only, so there is no theme switch. On
 * mobile the toasts sit above the bottom tab bar.
 */
export function Toaster(props: ToasterProps) {
  const { t } = useTranslation();

  return (
    <Sonner
      containerAriaLabel={t("shell.messages")}
      icons={{
        success: <CircleCheck className="size-4 text-(--color-status-success)" />,
        info: <Info className="size-4 text-(--color-status-info)" />,
        warning: <TriangleAlert className="size-4 text-(--color-status-warning)" />,
        error: <CircleAlert className="size-4 text-(--color-status-error)" />,
        loading: <LoaderCircle className="size-4 animate-spin" />,
      }}
      mobileOffset={{ bottom: 96 }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--color-text-default)",
          "--normal-border": "var(--color-border-default)",
          "--border-radius": "var(--radius-md)",
        } as CSSProperties
      }
      theme="light"
      {...props}
    />
  );
}
