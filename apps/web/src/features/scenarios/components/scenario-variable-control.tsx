import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format-number";
import { VARIABLE_RANGE, type ScenarioVariable } from "../lib/scenario-variables";
import { useMainChangeLabel } from "./scenario-parts";

/** The stops the labels name and the dots mark: the two ends, the middle and half way to each. */
const STOPS = [-10, -5, 0, 5, 10] as const;

const signed = (percent: number) => `${percent > 0 ? "+" : ""}${String(percent)} %`;

interface ScenarioVariableControlProps {
  variable: ScenarioVariable;
  onChange: (assetId: string, percent: number) => void;
}

/**
 * One price of the scenario, as the Figma "Variable control" draws it: what it is and its price
 * today, how far the scenario moves it (red down, green up, "Base" when it does not) with a reset
 * for that one, and the slider with the five stops written under it. The stop the slider is on is
 * the one in bold.
 */
export function ScenarioVariableControl({ variable, onChange }: ScenarioVariableControlProps) {
  const { t } = useTranslation();
  const mainChangeLabel = useMainChangeLabel();
  const name = mainChangeLabel({
    mainChange: {
      assetId: variable.assetId,
      symbol: variable.symbol,
      percentChange: variable.percent,
    },
  });
  const { percent } = variable;

  return (
    <div aria-label={name} className="flex flex-col gap-2" role="group">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm leading-5 font-medium text-(--color-text-default)">
          {name}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {variable.price === null ? null : (
            <span className="text-xs text-(--color-text-secondary)">
              {formatMoney(variable.price)}
            </span>
          )}
          <Badge tone={percent > 0 ? "success" : percent < 0 ? "error" : "neutral"}>
            {percent === 0 ? t("scenarios.editor.variables.base") : signed(percent)}
          </Badge>
          {percent === 0 ? null : (
            <Button
              aria-label={t("scenarios.editor.variables.reset", { name })}
              onClick={() => {
                onChange(variable.assetId, 0);
              }}
              size="icon-sm"
              variant="ghost"
            >
              <RotateCcw aria-hidden="true" />
            </Button>
          )}
        </span>
      </div>
      <Slider
        aria-label={name}
        marks={STOPS}
        max={VARIABLE_RANGE.max}
        min={VARIABLE_RANGE.min}
        onValueChange={(next) => {
          onChange(variable.assetId, next);
        }}
        step={VARIABLE_RANGE.step}
        value={percent}
      />
      <div className="flex justify-between text-xs">
        {STOPS.map((stop) => (
          <span
            className={cn(
              "text-(--color-text-secondary)",
              stop === percent && "font-semibold text-(--color-text-default)",
            )}
            data-testid={`step-${String(stop)}`}
            key={stop}
          >
            {stop === 0 ? t("scenarios.editor.variables.base") : signed(stop)}
          </span>
        ))}
      </div>
    </div>
  );
}
