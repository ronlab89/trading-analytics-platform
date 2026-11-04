import type { DecisionReplayResponse } from "@trading/contracts";
import { useMemo } from "react";
import { useReplayPlayer } from "../hooks/use-replay-player";
import { toTimelineItems } from "../lib/event-timeline";
import { toDecisionRow } from "../lib/decision-row";
import { replayStateAt } from "../lib/replay-state";
import { DecisionDetailHeader } from "./decision-detail-header";
import { DecisionIndicators } from "./decision-indicators";
import { DecisionReplayPanel } from "./decision-replay-panel";
import { DecisionThesisPanel } from "./decision-thesis-panel";
import { DecisionTimelinePanel } from "./decision-timeline-panel";

interface DecisionDetailProps {
  replay: DecisionReplayResponse;
  /** The asset behind the decision; null when it could not be loaded. */
  asset: { symbol: string; name: string } | null;
}

/**
 * One decision as the Figma "Detalle" draws it: the way back with the direction and status, the
 * four indicators, the replay controls, and the thesis beside the events of the position.
 */
export function DecisionDetail({ replay, asset }: DecisionDetailProps) {
  const { decision, events, currency } = replay;
  const items = useMemo(() => toTimelineItems(events, currency), [events, currency]);
  const row = toDecisionRow(decision, asset ?? undefined);
  const player = useReplayPlayer(items.length);
  const today = useMemo(() => replayStateAt(replay, events.length - 1), [replay, events.length]);

  return (
    <>
      <DecisionDetailHeader direction={row.direction} status={row.status} />
      <DecisionIndicators decision={decision} items={items} state={today} />
      <DecisionReplayPanel items={items} player={player} />
      <div className="grid gap-4 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] desktop:gap-6">
        <DecisionThesisPanel decision={decision} />
        <DecisionTimelinePanel currentIndex={player.index} items={items} />
      </div>
    </>
  );
}
