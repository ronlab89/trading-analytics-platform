import { MAX_COMPARED_SCENARIOS } from "@trading/contracts";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckboxItem } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useScenarios } from "../hooks/use-scenarios";
import { MIN_COMPARED_SCENARIOS } from "../lib/scenario-comparison";

interface CompareScenariosDialogProps {
  portfolioId: string;
  /** The scenarios being compared now, in order; the dialog starts from them each time it opens. */
  selected: readonly string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The scenarios to compare, in the order they were picked, which is the order of their letters. */
  onConfirm: (scenarioIds: string[]) => void;
}

/**
 * Picks the scenarios to compare, which the Figma does not draw: a checkbox for each scenario that
 * is not archived, two at least and five at most, in the order they are picked (that order gives
 * them their letters). At five the rest are locked until one is unchecked. It asks for the list on
 * its own, so any screen can open it knowing only the portfolio.
 */
export function CompareScenariosDialog({
  portfolioId,
  selected,
  open,
  onOpenChange,
  onConfirm,
}: CompareScenariosDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent aria-describedby={undefined} mobileSheet>
        <CompareScenariosForm onConfirm={onConfirm} portfolioId={portfolioId} selected={selected} />
      </DialogContent>
    </Dialog>
  );
}

interface CompareScenariosFormProps {
  portfolioId: string;
  selected: readonly string[];
  onConfirm: (scenarioIds: string[]) => void;
}

/** Mounted only while the dialog is open, so every opening starts from what is being compared. */
function CompareScenariosForm({ portfolioId, selected, onConfirm }: CompareScenariosFormProps) {
  const { t } = useTranslation();
  const scenarios = useScenarios(portfolioId);
  const [picked, setPicked] = useState<readonly string[]>(selected);

  const available = scenarios.data?.filter((scenario) => scenario.status !== "ARCHIVED");
  // A scenario that was being compared and is gone (deleted, archived) is not counted.
  const chosen = picked.filter((id) => available?.some((scenario) => scenario.id === id));
  const full = chosen.length >= MAX_COMPARED_SCENARIOS;
  const enough = available !== undefined && available.length >= MIN_COMPARED_SCENARIOS;

  const toggle = (id: string, checked: boolean) => {
    setPicked(checked ? [...chosen, id] : chosen.filter((other) => other !== id));
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("scenarios.compare.title")}</DialogTitle>
        <DialogDescription>{t("scenarios.compare.description")}</DialogDescription>
      </DialogHeader>
      <DialogBody className="gap-3">
        {scenarios.isError ? (
          <Alert
            action={
              <Button
                onClick={() => {
                  void scenarios.refetch();
                }}
                size="sm"
                variant="outline"
              >
                {t("scenarios.failed.retry")}
              </Button>
            }
            description={t("scenarios.failed.description")}
            title={t("scenarios.failed.title")}
            tone="error"
          />
        ) : available === undefined ? (
          <div aria-label={t("scenarios.compare.loading")} role="status">
            <Skeleton className="h-40 w-full" />
          </div>
        ) : !enough ? (
          <p className="text-sm text-(--color-text-secondary)">
            {t("scenarios.compare.notEnough")}
          </p>
        ) : (
          <>
            <div className="flex max-h-72 flex-col gap-3 overflow-y-auto">
              {available.map((scenario) => (
                <CheckboxItem
                  checked={chosen.includes(scenario.id)}
                  description={t(`scenarios.compare.status.${scenario.status}`, {
                    defaultValue: scenario.status,
                  })}
                  disabled={full && !chosen.includes(scenario.id)}
                  key={scenario.id}
                  label={scenario.name}
                  onCheckedChange={(checked) => {
                    toggle(scenario.id, checked === true);
                  }}
                />
              ))}
            </div>
            <div className="flex flex-col gap-1 text-sm text-(--color-text-secondary)">
              <p>
                {t("scenarios.compare.count", {
                  count: chosen.length,
                  max: MAX_COMPARED_SCENARIOS,
                })}
              </p>
              {full ? <p>{t("scenarios.compare.atMost")}</p> : null}
              {chosen.length < MIN_COMPARED_SCENARIOS ? (
                <p>{t("scenarios.compare.atLeast")}</p>
              ) : null}
            </div>
          </>
        )}
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            {t("scenarios.compare.cancel")}
          </Button>
        </DialogClose>
        <Button
          disabled={!enough || chosen.length < MIN_COMPARED_SCENARIOS}
          onClick={() => {
            onConfirm(chosen);
          }}
          type="button"
        >
          {t("scenarios.compare.confirm")}
        </Button>
      </DialogFooter>
    </>
  );
}
