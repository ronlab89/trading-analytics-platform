import type { AllocationResponse } from "@trading/contracts";

export type ConcentrationLevel = "LOW" | "MODERATE" | "HIGH";

export interface Concentration {
  /** The share of the largest group, 0 to 100. */
  percent: number;
  /** The label of that group, as the API names it. */
  label: string;
  level: ConcentrationLevel;
}

/** The thresholds of the analytics spec: above 50 is high, above 25 is moderate, otherwise low. */
const HIGH_ABOVE = 50;
const MODERATE_ABOVE = 25;

/**
 * How concentrated a portfolio is: the largest group of its allocation by asset and how risky that
 * weight is. A portfolio with no groups has nothing to measure, so it has no concentration (null).
 */
export function concentrationOf(groups: AllocationResponse["groups"]): Concentration | null {
  let largest: AllocationResponse["groups"][number] | undefined;
  for (const group of groups) {
    if (largest === undefined || group.percentage > largest.percentage) largest = group;
  }
  if (largest === undefined) return null;

  const { percentage } = largest;
  return {
    percent: percentage,
    label: largest.label,
    level: percentage > HIGH_ABOVE ? "HIGH" : percentage > MODERATE_ABOVE ? "MODERATE" : "LOW",
  };
}
