import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StatusDot } from "@/components/status-dot";
import { Button } from "@/components/ui/button";

export type Unread = { kind: "none" } | { kind: "dot" } | { kind: "count"; count: number };

interface NotificationButtonProps {
  unread: Unread;
  /** True while the notification panel is open. */
  open?: boolean;
  onClick: () => void;
}

/** The bell of the top bar: a ghost icon button with an orange dot or the unread count. */
export function NotificationButton({ unread, open = false, onClick }: NotificationButtonProps) {
  const { t } = useTranslation();
  const label =
    unread.kind === "count"
      ? t("shell.notificationsUnread", { count: unread.count })
      : t("shell.notifications");

  return (
    <Button
      aria-expanded={open}
      aria-label={label}
      className="relative aria-expanded:bg-(--color-button-ghost-background-pressed)"
      onClick={onClick}
      size="icon-sm"
      variant="ghost"
    >
      <Bell />
      {unread.kind === "dot" ? (
        <span
          aria-hidden="true"
          className="absolute top-1 left-4 flex size-3 items-center justify-center rounded-full bg-card"
        >
          <StatusDot size="md" tone="brand" />
        </span>
      ) : null}
      {unread.kind === "count" ? (
        <span
          aria-hidden="true"
          className="absolute -top-1 left-3.5 flex size-5 items-center justify-center rounded-full bg-card"
        >
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-(--color-brand-brand) px-1 text-xs font-semibold text-(--color-text-on-brand)">
            {unread.count > 9 ? "9+" : unread.count}
          </span>
        </span>
      ) : null}
    </Button>
  );
}
