import { CheckCheck, CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { NotificationResponse } from "@trading/contracts";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import { toPanelRows } from "../lib/panel-rows";

const SEVERITY_ICON = {
  INFO: Info,
  SUCCESS: CircleCheck,
  WARNING: TriangleAlert,
  ERROR: CircleAlert,
} as const satisfies Record<NotificationResponse["severity"], unknown>;

const SEVERITY_TONE = {
  INFO: "bg-(--color-status-info-muted) text-(--color-status-info)",
  SUCCESS: "bg-(--color-status-success-muted) text-(--color-status-success)",
  WARNING: "bg-(--color-status-warning-muted) text-(--color-status-warning)",
  ERROR: "bg-(--color-status-error-muted) text-(--color-status-error)",
} as const satisfies Record<NotificationResponse["severity"], string>;

const ROW = "flex w-full items-start gap-3 rounded-md px-3 py-2 text-left";

function RowContent({ notification }: { notification: NotificationResponse }) {
  const { t, i18n } = useTranslation();
  const Icon = SEVERITY_ICON[notification.severity];
  const unread = notification.readAt === null;

  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md",
          SEVERITY_TONE[notification.severity],
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            "truncate text-sm leading-5 text-(--color-text-default)",
            unread ? "font-semibold" : "font-normal text-(--color-text-secondary)",
          )}
        >
          <span className="sr-only">{t(`activity.severity.${notification.severity}`)}: </span>
          {notification.title}
        </span>
        <span className="truncate text-xs text-(--color-text-secondary)">
          {notification.message}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-xs text-(--color-text-secondary)">
          {formatRelativeTime(notification.createdAt, i18n.language)}
        </span>
        {unread ? (
          <>
            <span aria-hidden="true" className="size-2 rounded-full bg-(--color-brand-brand)" />
            <span className="sr-only">{t("shell.notificationsPanel.unread")}</span>
          </>
        ) : null}
      </span>
    </>
  );
}

interface NotificationsPanelProps {
  /** The notifications of the user, or `undefined` while they have not arrived. */
  notifications: readonly NotificationResponse[] | undefined;
  /** True when they could not be loaded. */
  failed: boolean;
  onRetry: () => void;
  onRead: (notificationId: string) => void;
  onReadAll: () => void;
  /** Called when the user follows the link to Activity, so the container can close. */
  onNavigate?: () => void;
}

/**
 * The inside of the notifications overlay (the Figma "Overlay · Notificaciones"): the latest
 * notifications with a severity icon, title, message and how long ago, an unread one in bold with a
 * dot; "Mark all as read" and a link to Activity at the bottom. It is shown in a popover from the
 * tablet width and in a bottom sheet on the phone, and it only draws what it is given.
 */
export function NotificationsPanel({
  notifications,
  failed,
  onRetry,
  onRead,
  onReadAll,
  onNavigate,
}: NotificationsPanelProps) {
  const { t } = useTranslation();
  const rows = notifications ? toPanelRows(notifications) : [];
  const hasUnread = notifications?.some(({ readAt }) => readAt === null) ?? false;

  return (
    <div className="flex w-full flex-col gap-1">
      <h2 className="px-3 pt-1 pb-1 text-sm font-semibold text-(--color-text-default)">
        {t("shell.notificationsPanel.title")}
      </h2>
      {notifications === undefined && failed ? (
        <div className="px-1">
          <Alert
            action={
              <Button onClick={onRetry} size="sm" variant="outline">
                {t("shell.notificationsPanel.failed.retry")}
              </Button>
            }
            description={t("shell.notificationsPanel.failed.description")}
            title={t("shell.notificationsPanel.failed.title")}
            tone="warning"
          />
        </div>
      ) : null}
      {notifications === undefined && !failed ? (
        <div
          aria-label={t("shell.notificationsPanel.loading")}
          className="flex flex-col gap-2 px-3 py-1"
          role="status"
        >
          {[0, 1, 2].map((index) => (
            <Skeleton className="h-10 w-full" key={index} />
          ))}
        </div>
      ) : null}
      {notifications && rows.length === 0 ? (
        <div className="flex flex-col items-center gap-1 px-3 py-6 text-center">
          <CircleCheck aria-hidden="true" className="size-6 text-(--color-text-secondary)" />
          <p className="text-sm font-medium text-(--color-text-default)">
            {t("shell.notificationsPanel.empty.title")}
          </p>
          <p className="text-xs text-(--color-text-secondary)">
            {t("shell.notificationsPanel.empty.description")}
          </p>
        </div>
      ) : null}
      {rows.length > 0 ? (
        <ul className="flex flex-col">
          {rows.map((notification) => (
            <li key={notification.id}>
              {notification.readAt === null ? (
                <button
                  className={cn(
                    ROW,
                    "hover:bg-(--color-surface-secondary) focus-visible:outline-2 focus-visible:outline-ring",
                  )}
                  onClick={() => {
                    onRead(notification.id);
                  }}
                  type="button"
                >
                  <RowContent notification={notification} />
                </button>
              ) : (
                <div className={ROW}>
                  <RowContent notification={notification} />
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      <Separator />
      <div className="flex flex-col gap-1">
        <Button
          className="justify-start"
          disabled={!hasUnread}
          onClick={onReadAll}
          size="sm"
          variant="ghost"
        >
          <CheckCheck />
          {t("shell.notificationsPanel.markAllRead")}
        </Button>
        <Button asChild className="justify-start" size="sm" variant="ghost">
          <Link onClick={onNavigate} to="/activity">
            {t("shell.notificationsPanel.viewAll")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
