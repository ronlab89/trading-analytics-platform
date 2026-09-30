import { Decimal } from "decimal.js";
import type { Decision } from "../entities/decision";
import type { DecisionEvent } from "../entities/decision-event";
import { DecisionDirection, DecisionEventType } from "../entities/enums";
import { Money } from "../value-objects/money";

/**
 * Decision Replay projection.
 * Source: docs/01-product-spec.md §14, docs/05-data-model.md §12-13,
 * docs/02-functional-requirements.md FR-034.
 *
 * Replay state is a *projection* of history, never a mutation of it:
 * the state at index N is derived by folding events[0..N] over an
 * initial "planned" state. This function is pure and does not mutate
 * `decision` or `events`, so the backend, the API and the public demo
 * can all share it (06-architecture.md §53, 12-demo-mode-spec.md §5).
 *
 * Contract with callers:
 * - `events` must already be in chronological order (this is what
 *   `DecisionEventRepository.listByDecisionId` returns).
 * - `currency` is supplied by the caller (in practice the asset's
 *   currency). `Decision` has no currency of its own: only its
 *   optional prices carry one, and all three may be null. Event
 *   payload prices are plain numbers and are interpreted in this
 *   currency.
 * - `currentIndex` is -1 ("before the first event") or a valid event
 *   index. Anything else is a programming error and throws, rather
 *   than being silently clamped.
 *
 * Event payload conventions (05-data-model.md §12 leaves `payload`
 * free-form; these are the shapes this projection understands):
 *
 *   DECISION_CREATED   {}                       (no state change)
 *   THESIS_RECORDED    { thesis?: string }      (falls back to decision.thesis)
 *   POSITION_OPENED    { quantity, price }
 *   PRICE_UPDATE       { price }
 *   RISK_CHANGED       { riskLevel: string }
 *   TARGET_REACHED     { price }                (market context; updates last price)
 *   POSITION_ADJUSTED  { quantity, price }      (quantity = NEW TOTAL, not a delta)
 *   POSITION_CLOSED    { price }
 *   NOTE_ADDED         { note: string }
 *
 * Malformed or out-of-sequence events never throw: they are ignored
 * for state purposes and reported in `issues`, so one bad payload
 * cannot turn a read endpoint into a 500.
 *
 * Known limitation: `riskLevel` starts from `decision.riskLevel`
 * because the model stores no "original" risk level. If a decision's
 * risk was later changed by a RISK_CHANGED event *and* the stored
 * `riskLevel` already reflects that change, early frames will show
 * the later value.
 *
 * P/L sign convention: SHORT positions gain when price falls.
 * NEUTRAL has no directional stance and is computed like LONG (raw
 * price difference).
 */

export type ReplayPhase = "PLANNED" | "OPEN" | "CLOSED";

export interface ReplayPosition {
  readonly quantity: number;
  readonly entryPrice: Money;
}

export interface DecisionReplayIssue {
  readonly eventId: string;
  readonly eventType: DecisionEventType;
  readonly message: string;
}

export interface DecisionReplayState {
  /** -1 means "before the first event". */
  readonly currentIndex: number;
  readonly totalEvents: number;
  readonly currentEvent: DecisionEvent | null;
  readonly phase: ReplayPhase;
  readonly thesis: string | null;
  readonly riskLevel: string | null;
  readonly notes: readonly string[];
  /** Non-null only while the position is OPEN. */
  readonly position: ReplayPosition | null;
  readonly lastPrice: Money | null;
  /** Non-null only while the position is OPEN and a last price is known. */
  readonly unrealizedPnL: Money | null;
  /** Non-null once any part of the position has been closed. */
  readonly realizedPnL: Money | null;
  readonly issues: readonly DecisionReplayIssue[];
}

export interface DecisionReplayInput {
  readonly decision: Decision;
  readonly events: readonly DecisionEvent[];
  readonly currency: string;
}

export class DecisionReplayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecisionReplayError";
  }
}

interface Accumulator {
  phase: ReplayPhase;
  thesis: string | null;
  riskLevel: string | null;
  notes: string[];
  position: ReplayPosition | null;
  lastPrice: Money | null;
  realizedPnL: Money | null;
  issues: DecisionReplayIssue[];
}

type Payload = Readonly<Record<string, unknown>>;

function readString(payload: Payload, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readPositiveNumber(payload: Payload, key: string): number | null {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * P/L of moving `quantity` units from `from` to `to`, direction-aware.
 * `quantity` accepts a string so callers can pass an exact decimal
 * (e.g. a quantity delta) without going through a JS float.
 */
function calculatePnL(
  direction: DecisionDirection,
  from: Money,
  to: Money,
  quantity: number | string,
): Money {
  const raw = to.subtract(from).multiply(quantity);
  return direction === DecisionDirection.SHORT ? raw.multiply(-1) : raw;
}

function addRealized(acc: Accumulator, amount: Money): void {
  acc.realizedPnL = acc.realizedPnL === null ? amount : acc.realizedPnL.add(amount);
}

function reportIssue(acc: Accumulator, event: DecisionEvent, message: string): void {
  acc.issues.push({ eventId: event.id, eventType: event.type, message });
}

function applyEvent(
  acc: Accumulator,
  event: DecisionEvent,
  decision: Decision,
  currency: string,
): void {
  const payload = event.payload;

  switch (event.type) {
    case DecisionEventType.DECISION_CREATED:
      return;

    case DecisionEventType.THESIS_RECORDED:
      acc.thesis = readString(payload, "thesis") ?? decision.thesis;
      return;

    case DecisionEventType.RISK_CHANGED: {
      const riskLevel = readString(payload, "riskLevel");
      if (riskLevel === null) {
        reportIssue(acc, event, "RISK_CHANGED requires a non-empty riskLevel.");
        return;
      }
      acc.riskLevel = riskLevel;
      return;
    }

    case DecisionEventType.NOTE_ADDED: {
      const note = readString(payload, "note");
      if (note === null) {
        reportIssue(acc, event, "NOTE_ADDED requires a non-empty note.");
        return;
      }
      acc.notes.push(note);
      return;
    }

    case DecisionEventType.PRICE_UPDATE:
    case DecisionEventType.TARGET_REACHED: {
      const price = readPositiveNumber(payload, "price");
      if (price === null) {
        reportIssue(acc, event, `${event.type} requires a positive numeric price.`);
        return;
      }
      acc.lastPrice = Money.of(price, currency);
      return;
    }

    case DecisionEventType.POSITION_OPENED: {
      if (acc.phase !== "PLANNED") {
        reportIssue(acc, event, "POSITION_OPENED is only valid before a position exists.");
        return;
      }
      const quantity = readPositiveNumber(payload, "quantity");
      const price = readPositiveNumber(payload, "price");
      if (quantity === null || price === null) {
        reportIssue(acc, event, "POSITION_OPENED requires a positive quantity and price.");
        return;
      }
      const entryPrice = Money.of(price, currency);
      acc.position = { quantity, entryPrice };
      acc.lastPrice = entryPrice;
      acc.phase = "OPEN";
      return;
    }

    case DecisionEventType.POSITION_ADJUSTED: {
      const position = acc.position;
      if (acc.phase !== "OPEN" || position === null) {
        reportIssue(acc, event, "POSITION_ADJUSTED is only valid while a position is open.");
        return;
      }
      const newQuantity = readPositiveNumber(payload, "quantity");
      const price = readPositiveNumber(payload, "price");
      if (newQuantity === null || price === null) {
        reportIssue(acc, event, "POSITION_ADJUSTED requires a positive quantity and price.");
        return;
      }

      const adjustmentPrice = Money.of(price, currency);

      if (newQuantity > position.quantity) {
        // Increase: weighted-average entry price.
        const added = new Decimal(newQuantity).minus(position.quantity).toString();
        const entryPrice = position.entryPrice
          .multiply(position.quantity)
          .add(adjustmentPrice.multiply(added))
          .divide(newQuantity);
        acc.position = { quantity: newQuantity, entryPrice };
      } else if (newQuantity < position.quantity) {
        // Reduction: entry price is unchanged; the reduced part is realized.
        const removed = new Decimal(position.quantity).minus(newQuantity).toString();
        addRealized(
          acc,
          calculatePnL(decision.direction, position.entryPrice, adjustmentPrice, removed),
        );
        acc.position = { quantity: newQuantity, entryPrice: position.entryPrice };
      }

      acc.lastPrice = adjustmentPrice;
      return;
    }

    case DecisionEventType.POSITION_CLOSED: {
      const position = acc.position;
      if (acc.phase !== "OPEN" || position === null) {
        reportIssue(acc, event, "POSITION_CLOSED is only valid while a position is open.");
        return;
      }
      const price = readPositiveNumber(payload, "price");
      if (price === null) {
        reportIssue(acc, event, "POSITION_CLOSED requires a positive numeric price.");
        return;
      }
      const exitPrice = Money.of(price, currency);
      addRealized(
        acc,
        calculatePnL(decision.direction, position.entryPrice, exitPrice, position.quantity),
      );
      acc.position = null;
      acc.lastPrice = exitPrice;
      acc.phase = "CLOSED";
      return;
    }

    default:
      // Event types are string-based at the wire level (see
      // DecisionEventType); an unknown one must not break the replay.
      reportIssue(acc, event, `Unsupported event type: ${String(event.type)}`);
  }
}

/**
 * Projects the replay state of a decision at `currentIndex`
 * (-1 = before the first event). See the module comment for the
 * contract and payload conventions.
 */
export function projectDecisionReplay(
  input: DecisionReplayInput,
  currentIndex: number,
): DecisionReplayState {
  const { decision, events, currency } = input;

  if (!Number.isInteger(currentIndex) || currentIndex < -1 || currentIndex >= events.length) {
    throw new DecisionReplayError(
      `Replay index ${String(currentIndex)} is out of range for ${String(events.length)} events.`,
    );
  }

  const acc: Accumulator = {
    phase: "PLANNED",
    thesis: null,
    riskLevel: decision.riskLevel,
    notes: [],
    position: null,
    lastPrice: null,
    realizedPnL: null,
    issues: [],
  };

  for (const event of events.slice(0, currentIndex + 1)) {
    applyEvent(acc, event, decision, currency);
  }

  const unrealizedPnL =
    acc.phase === "OPEN" && acc.position !== null && acc.lastPrice !== null
      ? calculatePnL(
          decision.direction,
          acc.position.entryPrice,
          acc.lastPrice,
          acc.position.quantity,
        )
      : null;

  return {
    currentIndex,
    totalEvents: events.length,
    currentEvent: currentIndex >= 0 ? (events[currentIndex] ?? null) : null,
    phase: acc.phase,
    thesis: acc.thesis,
    riskLevel: acc.riskLevel,
    notes: acc.notes,
    position: acc.position,
    lastPrice: acc.lastPrice,
    unrealizedPnL,
    realizedPnL: acc.realizedPnL,
    issues: acc.issues,
  };
}
