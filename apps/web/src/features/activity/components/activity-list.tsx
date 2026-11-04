import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { formatCalendarDay, formatClockTime } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import type { ActivityDay, ActivityEvent, ActivitySeverity } from "../lib/activity-events";

const SEVERITY_ICON = {
  INFO: Info,
  SUCCESS: CircleCheck,
  WARNING: TriangleAlert,
  ERROR: CircleAlert,
} as const satisfies Record<ActivitySeverity, unknown>;

const SEVERITY_TONE = {
  INFO: "bg-(--color-status-info-muted) text-(--color-status-info)",
  SUCCESS: "bg-(--color-status-success-muted) text-(--color-status-success)",
  WARNING: "bg-(--color-status-warning-muted) text-(--color-status-warning)",
  ERROR: "bg-(--color-status-error-muted) text-(--color-status-error)",
} as const satisfies Record<ActivitySeverity, string>;

interface ActivityRowProps {
  event: ActivityEvent;
  action?: ReactNode;
}

function ActivityRow({ event, action }: ActivityRowProps) {
  const { t, i18n } = useTranslation();
  const Icon = SEVERITY_ICON[event.severity];

  return (
    <li className="flex items-start gap-3 py-3">
      <span
        aria-hidden="true"
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-md",
          SEVERITY_TONE[event.severity],
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-sm leading-5 font-medium text-(--color-text-default)">
          <span className="sr-only">{t(`activity.severity.${event.severity}`)}: </span>
          {event.title}
        </p>
        <p className="text-sm text-(--color-text-secondary)">{event.message}</p>
        <p className="text-xs text-(--color-text-secondary)">
          {t(`activity.source.${event.source}`)} ·{" "}
          {formatClockTime(event.occurredAt, i18n.language)}
        </p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </li>
  );
}

interface ActivityListProps {
  days: readonly ActivityDay[];
  /** What the row offers to do with its event, if anything: the list does not know the screens. */
  renderAction?: (event: ActivityEvent) => ReactNode;
}

/** The activity by day: today, yesterday, then dates; each day says how many events it holds. */
export function ActivityList({ days, renderAction }: ActivityListProps) {
  const { t, i18n } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      {days.map((group) => {
        const headingId = `activity-day-${group.day}`;
        const title =
          group.label === "date"
            ? formatCalendarDay(group.day, i18n.language)
            : t(`activity.day.${group.label}`);

        return (
          <section aria-labelledby={headingId} key={group.day}>
            <div className="flex items-baseline justify-between gap-3 border-b border-(--color-border-default) pb-2">
              <h2 className="text-sm font-semibold text-(--color-text-default)" id={headingId}>
                {title}
              </h2>
              <span className="text-xs text-(--color-text-secondary)">
                {t("activity.eventsCount", { count: group.events.length })}
              </span>
            </div>
            <ul className="m-0 flex list-none flex-col divide-y divide-(--color-border-default) p-0">
              {group.events.map((item) => (
                <ActivityRow action={renderAction?.(item)} event={item} key={item.id} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
