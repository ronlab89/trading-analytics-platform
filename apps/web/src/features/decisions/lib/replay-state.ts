import {
  presentDecisionReplayState,
  type DecisionReplayResponse,
  type DecisionReplayStateResponse,
} from "@trading/contracts";
import {
  Money,
  projectDecisionReplay,
  type Decision,
  type DecisionEvent,
  type DecisionReplayInput,
} from "@trading/domain";

type MoneyDto = DecisionReplayResponse["decision"]["entryPrice"];

const toMoney = (price: MoneyDto) =>
  price === null ? null : Money.of(price.amount, price.currency);

/** The replay the API sent as the input the domain projection reads: dates and money, not text. */
function toReplayInput({
  decision,
  events,
  currency,
}: DecisionReplayResponse): DecisionReplayInput {
  const domainDecision: Decision = {
    ...decision,
    entryPrice: toMoney(decision.entryPrice),
    targetPrice: toMoney(decision.targetPrice),
    stopPrice: toMoney(decision.stopPrice),
    createdAt: new Date(decision.createdAt),
    closedAt: decision.closedAt === null ? null : new Date(decision.closedAt),
  };
  const domainEvents: DecisionEvent[] = events.map((event) => ({
    ...event,
    timestamp: new Date(event.timestamp),
  }));

  return { decision: domainDecision, events: domainEvents, currency };
}

/**
 * What the decision looked like after the event at `index` (`-1` is before the first one): the
 * phase, the position, the last price and the profit or loss at that moment. It is the very same
 * pure projection the server uses, so the replay and the API never disagree. History is only read:
 * nothing here changes the decision or its events. An index outside the events is a programming
 * error and throws.
 */
export function replayStateAt(
  replay: DecisionReplayResponse,
  index: number,
): DecisionReplayStateResponse {
  return presentDecisionReplayState(projectDecisionReplay(toReplayInput(replay), index));
}
