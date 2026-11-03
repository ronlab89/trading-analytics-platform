import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DecisionsSection } from "@/features/decisions/components/decisions-section";
import { useDecisionRows } from "@/features/decisions/hooks/use-decision-rows";
import { PortfoliosEmptyState } from "@/features/portfolios/components/portfolios-empty-state";
import { NewTransactionPanel } from "@/features/transactions/components/new-transaction-panel";
import { useAnnounceRecorded } from "@/features/transactions/hooks/use-announce-recorded";
import { useActivePortfolio } from "@/hooks/use-active-portfolio";
import { useIsMobile } from "@/hooks/use-media-query";

/**
 * The Decision Center of the active portfolio: the line that counts its decisions and the list. The
 * portfolio is the `key` of the content, so choosing another one starts from its own list and its
 * own search. Without a portfolio there is nothing to list, so the page says so, as the other
 * views do.
 */
export function DecisionsPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { active, isPending, isError, retry } = useActivePortfolio();

  return (
    <div className="flex flex-col gap-4 desktop:gap-6">
      <h1
        className={
          isMobile ? "text-2xl leading-8 font-semibold text-(--color-text-default)" : "sr-only"
        }
      >
        {t("nav.decisions")}
      </h1>
      {active !== undefined ? (
        <Decisions key={active.id} portfolioId={active.id} />
      ) : isError ? (
        <Alert
          action={
            <Button onClick={retry} size="sm" variant="outline">
              {t("decisions.failed.retry")}
            </Button>
          }
          description={t("decisions.failed.description")}
          title={t("decisions.failed.title")}
          tone="error"
        />
      ) : isPending ? null : (
        <section className="rounded-xl bg-(--color-surface-card) p-6">
          <PortfoliosEmptyState
            description={t("portfolios.empty.description")}
            title={t("portfolios.empty.title")}
          />
        </section>
      )}
    </div>
  );
}

function Decisions({ portfolioId }: { portfolioId: string }) {
  const { t } = useTranslation();
  const [panelOpen, setPanelOpen] = useState(false);
  const announceRecorded = useAnnounceRecorded();
  const { rows, isError, refetch } = useDecisionRows(portfolioId);
  const open = rows?.filter((row) => row.status === "OPEN").length ?? 0;

  return (
    <>
      {rows === undefined || rows.length === 0 ? null : (
        <p className="text-sm text-(--color-text-secondary)">
          {t("decisions.summary.registered", { count: rows.length })} ·{" "}
          {t("decisions.summary.open", { count: open })}
        </p>
      )}
      <DecisionsSection
        isError={isError}
        onNew={() => {
          setPanelOpen(true);
        }}
        onRetry={() => {
          void refetch();
        }}
        rows={rows}
      />
      <NewTransactionPanel
        onOpenChange={setPanelOpen}
        onRecorded={announceRecorded}
        open={panelOpen}
        portfolioId={portfolioId}
      />
    </>
  );
}
