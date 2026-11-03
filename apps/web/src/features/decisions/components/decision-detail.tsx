import type { DecisionReplayResponse } from "@trading/contracts";
import { useMemo } from "react";
import { toTimelineItems } from "../lib/event-timeline";
import { toDecisionRow } from "../lib/decision-row";
import { DecisionDetailHeader } from "./decision-detail-header";
import { DecisionIndicators } from "./decision-indicators";
import { DecisionThesisPanel } from "./decision-thesis-panel";
import { DecisionTimelinePanel } from "./decision-timeline-panel";

interface DecisionDetailProps {
  replay: DecisionReplayResponse;
  /** The asset behind the decision; null when it could not be loaded. */
  asset: { symbol: string; name: string } | null;
}

/**
 * One decision as the Figma "Detalle" draws it: the way back with the direction and status, the
 * four indicators, and the thesis beside the events of the position. This is the history as it
 * stands, with nothing to replay yet.
 */
export function DecisionDetail({ replay, asset }: DecisionDetailProps) {
  const { decision, events, currency } = replay;
  const items = useMemo(() => toTimelineItems(events, currency), [events, currency]);
  const row = toDecisionRow(decision, asset ?? undefined);

  return (
    <>
      <DecisionDetailHeader direction={row.direction} status={row.status} />
      <DecisionIndicators decision={decision} items={items} />
      <div className="grid gap-4 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] desktop:gap-6">
        <DecisionThesisPanel decision={decision} />
        <DecisionTimelinePanel items={items} />
      </div>
    </>
  );
}
