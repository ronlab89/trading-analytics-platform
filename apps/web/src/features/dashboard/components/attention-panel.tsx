import { CircleCheck, Info, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PortfoliosEmptyState } from "@/features/portfolios/components/portfolios-empty-state";
import { formatRelativeTime } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import { useNotifications } from "../hooks/use-notifications";
import { type AttentionItem, toAttention } from "../lib/attention-items";

/** How many notifications the panel lists, as many as the Figma draws. */
const VISIBLE = 3;

const KIND_ICON = { alert: TriangleAlert, info: Info, completed: CircleCheck } as const;

const TONE_CLASS = {
  warning: "bg-(--color-status-warning-muted)",
  error: "bg-(--color-status-error-muted)",
  neutral: "bg-(--color-surface-secondary)",
} as const;

function Item({ item }: { item: AttentionItem }) {
  const { t, i18n } = useTranslation();
  const Icon = KIND_ICON[item.kind];

  return (
    <li className={cn("flex items-start gap-3 rounded-lg p-3", TONE_CLASS[item.tone])}>
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-md bg-(--color-surface-card)"
      >
        <Icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[11px] font-semibold tracking-wide text-(--color-text-secondary) uppercase">
          {t(`dashboard.attention.kinds.${item.kind}`)}
        </span>
        <p className="text-sm leading-5 font-medium text-(--color-text-default)">{item.title}</p>
        <p className="text-xs text-(--color-text-secondary)">
          {item.message} · {formatRelativeTime(item.createdAt, i18n.language)}
        </p>
      </div>
    </li>
  );
}

/**
 * The Figma "Requiere atención": the latest unread notifications of the user (alerts, news and
 * completed events), each with its kind, title, message and how long ago, and how many are unread
 * in all. It asks for its own data, so it loads, fails and retries on its own. The Figma also puts
 * an ↗ button on each item and a "Cálculo al día" line at the bottom; there is no page to open the
 * notification on yet and no calculation time, so both are left out.
 */
export function AttentionPanel() {
  const { t } = useTranslation();
  const notifications = useNotifications();
  const attention = notifications.data ? toAttention(notifications.data, VISIBLE) : null;

  return (
    <section
      aria-labelledby="dashboard-attention-title"
      className="flex flex-col gap-4 rounded-xl bg-(--color-surface-card) p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          className="text-lg leading-6 font-medium text-(--color-text-default)"
          id="dashboard-attention-title"
        >
          {t("dashboard.attention.title")}
        </h2>
        {attention !== null && attention.unread > 0 ? (
          <span
            aria-label={t("dashboard.attention.count", { count: attention.unread })}
            className="rounded-md bg-(--color-surface-secondary) px-2 py-0.5 text-xs font-medium text-(--color-text-default)"
          >
            {attention.unread}
          </span>
        ) : null}
      </div>
      {notifications.isError ? (
        <Alert
          action={
            <Button
              onClick={() => {
                void notifications.refetch();
              }}
              size="sm"
              variant="outline"
            >
              {t("dashboard.attention.failed.retry")}
            </Button>
          }
          description={t("dashboard.attention.failed.description")}
          title={t("dashboard.attention.failed.title")}
          tone="error"
        />
      ) : attention === null ? (
        <div
          aria-label={t("dashboard.attention.loading")}
          className="flex flex-col gap-2"
          role="status"
        >
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : attention.items.length === 0 ? (
        <PortfoliosEmptyState
          description={t("dashboard.attention.empty.description")}
          title={t("dashboard.attention.empty.title")}
        />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {attention.items.map((item) => (
            <Item item={item} key={item.id} />
          ))}
        </ul>
      )}
    </section>
  );
}
