import type { Actor, Clock } from "@trading/application";
import type { DemoComposition } from "../demo-composition";

/** What a handler receives: the request already checked against the contract of its operation. */
export interface HandlerInput {
  readonly params: unknown;
  readonly query: unknown;
  readonly body: unknown;
}

/** The state of the demo session; the client owns it and the auth handlers change it. */
export interface DemoSession {
  signedIn: boolean;
}

export interface HandlerContext {
  readonly composition: DemoComposition;
  readonly session: DemoSession;
  readonly clock: Clock;
  readonly actor: Actor;
}

/** Returns the body the API would answer, envelope included; `undefined` for a 204. */
export type Handler = (input: HandlerInput) => Promise<unknown>;

export type HandlerRegistry = Readonly<Record<string, Handler>>;
