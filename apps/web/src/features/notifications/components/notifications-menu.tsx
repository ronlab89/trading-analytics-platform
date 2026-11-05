import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { NotificationButton, type Unread } from "@/components/shell/notification-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useNotifications } from "@/features/dashboard/hooks/use-notifications";
import { useIsMobile } from "@/hooks/use-media-query";
import { useMarkAllNotificationsRead } from "../hooks/use-mark-all-notifications-read";
import { useMarkNotificationRead } from "../hooks/use-mark-notification-read";
import { NotificationsPanel } from "./notifications-panel";

interface NotificationsMenuProps {
  unread: Unread;
}

/**
 * The bell and the panel it opens: a popover under the bell from the tablet width, and a bottom
 * sheet on the phone, with the same content. It reads the notifications the shell already keeps,
 * and a click marks one as read (or all of them) at once, telling the user if the server refuses.
 */
export function NotificationsMenu({ unread }: NotificationsMenuProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const refused = () => {
    toast.error(t("shell.notificationsPanel.markFailed"));
  };
  const panel = (
    <NotificationsPanel
      failed={notifications.isError}
      notifications={notifications.data}
      onNavigate={() => {
        setOpen(false);
      }}
      onRead={(notificationId) => {
        markRead.mutate(notificationId, { onError: refused });
      }}
      onReadAll={() => {
        markAllRead.mutate(undefined, { onError: refused });
      }}
      onRetry={() => {
        void notifications.refetch();
      }}
    />
  );

  if (isMobile) {
    return (
      <Sheet onOpenChange={setOpen} open={open}>
        <SheetTrigger asChild>
          <NotificationButton unread={unread} />
        </SheetTrigger>
        <SheetContent>
          <SheetTitle className="sr-only">{t("shell.notificationsPanel.title")}</SheetTitle>
          {panel}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <NotificationButton unread={unread} />
      </PopoverTrigger>
      <PopoverContent aria-label={t("shell.notificationsPanel.title")}>{panel}</PopoverContent>
    </Popover>
  );
}
