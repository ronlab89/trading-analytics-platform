import { TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { gaugeArcPath, gaugeSegments, pointOnGauge } from "../lib/gauge-geometry";

type VolatilityClassification = "LOW" | "MODERATE" | "HIGH" | "UNKNOWN";

interface RiskPanelProps {
  volatility: {
    classification: VolatilityClassification;
    /** The annualized volatility in percent, or null when there is too little history. */
    value: number | null;
  };
}

/** The Figma "Nivel de riesgo" shows five steps; the API classifies in three, so the gauge has three. */
const LEVELS = ["LOW", "MODERATE", "HIGH"] as const;
const SEGMENTS = gaugeSegments(LEVELS.length, 6);
const CENTER = { x: 100, y: 100 };
const RADIUS = 80;
const NEEDLE_LENGTH = 62;

const LEVEL_KEY = {
  LOW: "dashboard.risk.low",
  MODERATE: "dashboard.risk.moderate",
  HIGH: "dashboard.risk.high",
  UNKNOWN: "dashboard.risk.unknown",
} as const;

/** The slope that joins the folder tab to the card, as in the "Retorno total" panel. */
const SLOPE = "[clip-path:polygon(0_0,0_100%,100%_100%)]";

const ACTIVE_COLOR = {
  LOW: "var(--color-chart-gain)",
  MODERATE: "var(--color-status-warning)",
  HIGH: "var(--color-chart-loss)",
} as const;

/**
 * The Figma "Nivel de riesgo": a dark folder card with a half-circle gauge, its needle on the level
 * of the portfolio's volatility, the level in words and the annualized volatility under it. The
 * steps before the active one are lit, the ones after it are the track. Moderate and high carry the
 * "Alerta" badge. The gauge is only a picture: the level and the figure are written out, so it is
 * hidden from a screen reader. The Figma's fifth step ("Nivel 3 de 5") and the line about the
 * threshold being crossed need data the API does not have, so they are left out.
 */
export function RiskPanel({ volatility }: RiskPanelProps) {
  const { t } = useTranslation();
  const { classification, value } = volatility;
  const activeIndex = classification === "UNKNOWN" ? -1 : LEVELS.indexOf(classification);
  const needle = SEGMENTS[activeIndex];
  const needleEnd = needle ? pointOnGauge(CENTER, NEEDLE_LENGTH, needle.middle) : null;
  const title = t("dashboard.risk.title");
  const alert = classification === "MODERATE" || classification === "HIGH";

  return (
    <section aria-label={title} className="flex flex-col">
      <div className="flex h-6 items-end">
        <span className="flex h-6 items-center rounded-tl-lg bg-(--color-surface-inverse) pr-2 pl-3 text-xs font-semibold text-(--color-text-on-primary)">
          {title}
        </span>
        <span aria-hidden="true" className={`h-6 w-3.5 bg-(--color-surface-inverse) ${SLOPE}`} />
      </div>
      <div className="flex min-h-72 flex-1 flex-col items-center gap-4 rounded-b-xl rounded-tr-xl bg-(--color-surface-inverse) p-6 text-(--color-text-on-primary)">
        <div className="flex h-6 w-full">
          {alert ? (
            <span className="flex items-center gap-1 rounded-md bg-(--color-status-warning) px-2 text-xs font-medium text-(--color-text-on-warning)">
              <TriangleAlert aria-hidden="true" className="size-3.5" />
              {t("dashboard.risk.alert")}
            </span>
          ) : null}
        </div>
        <svg aria-hidden="true" className="w-full max-w-56" viewBox="0 0 200 112">
          {SEGMENTS.map((segment, index) => (
            <path
              d={gaugeArcPath(CENTER, RADIUS, segment.from, segment.to)}
              fill="none"
              key={LEVELS[index]}
              stroke={
                index === activeIndex
                  ? ACTIVE_COLOR[LEVELS[index] ?? "LOW"]
                  : index < activeIndex
                    ? "var(--color-chart-gauge-segment)"
                    : "var(--color-chart-gauge-track)"
              }
              strokeWidth={14}
            />
          ))}
          {needleEnd ? (
            <>
              <line
                stroke="var(--color-text-on-primary)"
                strokeLinecap="round"
                strokeWidth={3}
                x1={CENTER.x}
                x2={needleEnd.x}
                y1={CENTER.y}
                y2={needleEnd.y}
              />
              <circle cx={CENTER.x} cy={CENTER.y} fill="var(--color-text-on-primary)" r={5} />
            </>
          ) : null}
        </svg>
        <p className="text-2xl leading-8 font-medium">{t(LEVEL_KEY[classification])}</p>
        <p className={cn("text-center text-xs text-(--color-text-on-primary-muted)")}>
          {value === null
            ? t("dashboard.risk.volatilityUnknown")
            : t("dashboard.risk.volatility", { value: `${value.toFixed(1)}%` })}
        </p>
      </div>
    </section>
  );
}
