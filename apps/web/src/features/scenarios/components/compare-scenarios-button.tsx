import { GitCompare } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { compareScenariosPath } from "../lib/compare-path";
import { CompareScenariosDialog } from "./compare-scenarios-dialog";

interface CompareScenariosButtonProps {
  portfolioId: string;
  className?: string | undefined;
}

/**
 * "Comparar": opens the picker of scenarios and, once two to five are chosen, goes to their
 * comparison. It owns the dialog, so the Scenario Lab and the editor only place the button.
 */
export function CompareScenariosButton({ portfolioId, className }: CompareScenariosButtonProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        className={className}
        onClick={() => {
          setOpen(true);
        }}
        variant="outline"
      >
        <GitCompare aria-hidden="true" />
        {t("scenarios.compare.action")}
      </Button>
      <CompareScenariosDialog
        onConfirm={(ids) => {
          setOpen(false);
          void navigate(compareScenariosPath(ids));
        }}
        onOpenChange={setOpen}
        open={open}
        portfolioId={portfolioId}
        selected={[]}
      />
    </>
  );
}
