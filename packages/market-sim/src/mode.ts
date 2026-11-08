/**
 * Market modes.
 * Source: 12-demo-mode-spec.md §37, 08-realtime-spec.md §37 (wire identifiers, ADR-007 point 15).
 */
export const MarketMode = {
  PAUSED: "PAUSED",
  NORMAL: "NORMAL",
  VOLATILE: "VOLATILE",
  BULLISH: "BULLISH",
  BEARISH: "BEARISH",
} as const;

export type MarketMode = (typeof MarketMode)[keyof typeof MarketMode];

/**
 * How a price moves in one tick: the logarithm of the price ratio is `drift` plus `volatility`
 * times a standard normal draw. Both are fractions per tick, tuned for a 1 second tick
 * (08-realtime-spec.md §38) so the demo shows visible movement without a price running away.
 */
export interface PriceProfile {
  readonly drift: number;
  readonly volatility: number;
}

const MODE_PROFILES: Readonly<Record<MarketMode, PriceProfile>> = {
  PAUSED: { drift: 0, volatility: 0 },
  NORMAL: { drift: 0, volatility: 0.0005 },
  VOLATILE: { drift: 0, volatility: 0.002 },
  BULLISH: { drift: 0.00005, volatility: 0.0005 },
  BEARISH: { drift: -0.00005, volatility: 0.0005 },
};

export function modeProfile(mode: MarketMode): PriceProfile {
  return MODE_PROFILES[mode];
}
