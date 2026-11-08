import { Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { AnalyticsPanel } from "@/features/analytics/components/analytics-panel";
import { useIsMobile } from "@/hooks/use-media-query";
import { formatMomentDay, formatMomentFullDay } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import { REPLAY_SPEEDS, type ReplayPlayer } from "../hooks/use-replay-player";
import type { TimelineItem } from "../lib/event-timeline";

const PLAY_BUTTON = {
  paused: { labelKey: "play", Icon: Play },
  playing: { labelKey: "pause", Icon: Pause },
  finished: { labelKey: "restart", Icon: RotateCcw },
} as const;

const percentOf = (index: number, total: number) =>
  total <= 1 ? 100 : (index / (total - 1)) * 100;

/** The line with a stop per event, evenly spaced as the Figma draws it, filled up to the current. */
function ReplayProgress({ index, total, label }: { index: number; total: number; label: string }) {
  const percent = percentOf(index, total);

  return (
    <div
      aria-label={label}
      aria-valuemax={total}
      aria-valuemin={1}
      aria-valuenow={index + 1}
      className="relative mx-2 h-6 min-w-0 flex-1"
      role="progressbar"
    >
      <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-(--color-border-default)" />
      <div
        className="absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full bg-(--color-button-primary-background)"
        style={{ width: `${String(percent)}%` }}
      />
      {Array.from({ length: total }, (_, stop) => (
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-(--color-button-primary-background)",
            stop <= index ? "bg-(--color-button-primary-background)" : "bg-(--color-surface-card)",
          )}
          key={stop}
          style={{ left: `${String(percentOf(stop, total))}%` }}
        />
      ))}
      <span
        aria-hidden="true"
        className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-(--color-button-primary-background) bg-(--color-surface-card)"
        style={{ left: `${String(percent)}%` }}
      />
    </div>
  );
}

interface DecisionReplayPanelProps {
  player: ReplayPlayer;
  items: readonly TimelineItem[];
}

/**
 * The Figma "Reproducción": the buttons that move through the events of a decision, the line that
 * shows how far it has gone, the day of the current event and the speed. A decision without events
 * has nothing to replay, so the panel is not drawn. The state lives in the player, because the rest
 * of the page follows the same event. On a phone the pieces stack: the line, then the day with the
 * speed, then larger buttons in the center.
 */
export function DecisionReplayPanel({ player, items }: DecisionReplayPanelProps) {
  const { t, i18n } = useTranslation();
  const isMobile = useIsMobile();
  const current = items[player.index];
  if (current === undefined) return null;

  const { labelKey, Icon } = PLAY_BUTTON[player.status];
  const buttonSize = isMobile ? "icon-lg" : "icon-sm";

  const buttons = (
    <>
      <Button
        aria-label={t("decisions.detail.replay.previous")}
        disabled={!player.canGoPrevious}
        onClick={player.previous}
        size={buttonSize}
        variant="outline"
      >
        <SkipBack aria-hidden="true" />
      </Button>
      <Button
        aria-label={t(`decisions.detail.replay.${labelKey}`)}
        disabled={player.status === "finished" && items.length <= 1}
        onClick={player.toggle}
        size={buttonSize}
      >
        <Icon aria-hidden="true" />
      </Button>
      <Button
        aria-label={t("decisions.detail.replay.next")}
        disabled={!player.canGoNext}
        onClick={player.next}
        size={buttonSize}
        variant="outline"
      >
        <SkipForward aria-hidden="true" />
      </Button>
    </>
  );
  const progress = (
    <ReplayProgress
      index={player.index}
      label={t("decisions.detail.replay.progress")}
      total={items.length}
    />
  );
  const day = (
    <time
      className="shrink-0 text-sm font-medium text-(--color-text-default)"
      dateTime={current.timestamp}
    >
      {formatMomentDay(current.timestamp, i18n.language)}
    </time>
  );
  const speeds = (
    <div
      aria-label={t("decisions.detail.replay.speed")}
      className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-(--color-surface-secondary) p-1"
      role="group"
    >
      {REPLAY_SPEEDS.map((speed) => (
        <button
          aria-pressed={player.speed === speed}
          className={cn(
            "h-5 rounded-md px-2 text-xs font-medium whitespace-nowrap transition-colors select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-button-focus-ring)",
            player.speed === speed
              ? "bg-(--color-button-primary-background) text-(--color-button-primary-foreground)"
              : "text-(--color-text-secondary) hover:text-(--color-text-default)",
          )}
          key={speed}
          onClick={() => {
            player.setSpeed(speed);
          }}
          type="button"
        >
          {`${String(speed)}×`}
        </button>
      ))}
    </div>
  );

  return (
    <AnalyticsPanel
      subtitle={t(
        isMobile && player.status === "paused"
          ? "decisions.detail.replay.pausedShort"
          : `decisions.detail.replay.status.${player.status}`,
        {
          current: player.index + 1,
          total: items.length,
          date: formatMomentFullDay(current.timestamp, i18n.language),
        },
      )}
      title={t("decisions.detail.replay.title")}
    >
      {isMobile ? (
        <div className="flex flex-col gap-3">
          <div className="flex">{progress}</div>
          <div className="flex items-center justify-between gap-2">
            {day}
            {speeds}
          </div>
          <div className="flex justify-center gap-4">{buttons}</div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {buttons}
          {progress}
          {day}
          {speeds}
        </div>
      )}
    </AnalyticsPanel>
  );
}
