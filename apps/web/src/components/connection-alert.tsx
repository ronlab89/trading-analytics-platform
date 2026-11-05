import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { clockTime } from "@/components/shell/connection-status";
import { useLastDataAt } from "@/hooks/use-last-data-at";
import { useConnectionState, useRealtimeClient } from "@/realtime/realtime-client-provider";

/**
 * The notice that the numbers on a section are not live (FE3.0 §1). It takes no props: it reads the
 * connection and the time of the last data, so each section with live numbers just renders it.
 * While the client reconnects it is a warning; once it gave up (`failed`) it is an error with a
 * manual retry. It says nothing while connected or connecting, and not before the first connection
 * either (`disconnected`), so it does not flash on the way in.
 */
export function ConnectionAlert() {
  const { t } = useTranslation();
  const state = useConnectionState();
  const client = useRealtimeClient();
  const lastDataAt = useLastDataAt();

  if (state !== "reconnecting" && state !== "failed") return null;

  const time = lastDataAt === undefined ? undefined : clockTime(lastDataAt);
  const failed = state === "failed";
  const key = failed ? "failed" : "reconnecting";

  return (
    <Alert
      action={
        failed ? (
          <Button
            onClick={() => {
              client.retry();
            }}
            size="sm"
            variant="outline"
          >
            {t("shell.connectionAlert.retry")}
          </Button>
        ) : undefined
      }
      description={
        time === undefined
          ? t(`shell.connectionAlert.${key}.description`)
          : t(`shell.connectionAlert.${key}.descriptionAt`, { time })
      }
      title={t(`shell.connectionAlert.${key}.title`)}
      tone={failed ? "error" : "warning"}
    />
  );
}
