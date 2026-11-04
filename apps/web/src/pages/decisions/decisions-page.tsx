import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DecisionsSection } from "@/features/decisions/components/decisions-section";
import { useDecisionRows } from "@/features/decisions/hooks/use-decision-rows";
import { ScenariosSection } from "@/features/scenarios/components/scenarios-section";
import { ScenariosSummary } from "@/features/scenarios/components/scenarios-summary";
import { useScenarioRows } from "@/features/scenarios/hooks/use-scenario-rows";
import { PortfoliosEmptyState } from "@/features/portfolios/components/portfolios-empty-state";
import { NewTransactionPanel } from "@/features/transactions/components/new-transaction-panel";
import { useAnnounceRecorded } from "@/features/transactions/hooks/use-announce-recorded";
import { useActivePortfolio } from "@/hooks/use-active-portfolio";
import { useIsMobile } from "@/hooks/use-media-query";
import { useDecisionCenterTab, type DecisionCenterTab } from "./use-decision-center-tab";

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
        <Decisions key={active.id} portfolioId={active.id} portfolioName={active.name} />
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

function Decisions({ portfolioId, portfolioName }: { portfolioId: string; portfolioName: string }) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [tab, selectTab] = useDecisionCenterTab();
  const [panelOpen, setPanelOpen] = useState(false);
  const announceRecorded = useAnnounceRecorded();
  const decisions = useDecisionRows(portfolioId);
  const scenarios = useScenarioRows(portfolioId);
  const open = decisions.rows?.filter((row) => row.status === "OPEN").length ?? 0;

  const tabs = (
    <TabsList aria-label={t("decisions.tabs.label")} className={isMobile ? "w-full" : undefined}>
      <TabsTrigger className={isMobile ? "flex-1" : undefined} value="replay">
        {t("decisions.tabs.replay")}
      </TabsTrigger>
      <TabsTrigger className={isMobile ? "flex-1" : undefined} value="lab">
        {t("decisions.tabs.lab")}
      </TabsTrigger>
    </TabsList>
  );
  const summary =
    tab === "lab" ? (
      <ScenariosSummary portfolioName={portfolioName} rows={scenarios.rows} />
    ) : decisions.rows === undefined || decisions.rows.length === 0 ? null : (
      <p className="text-sm text-(--color-text-secondary)">
        {t("decisions.summary.registered", { count: decisions.rows.length })} ·{" "}
        {t("decisions.summary.open", { count: open })}
      </p>
    );

  return (
    <>
      <Tabs
        className="flex flex-col gap-4 desktop:gap-6"
        onValueChange={(value) => {
          selectTab(value as DecisionCenterTab);
        }}
        value={tab}
      >
        {isMobile ? (
          <>
            {tabs}
            {tab === "replay" ? summary : null}
          </>
        ) : (
          <div className="flex min-h-9 items-center justify-between gap-4">
            {summary ?? <span />}
            {tabs}
          </div>
        )}
        <TabsContent className="flex flex-col gap-4" value="replay">
          <DecisionsSection
            isError={decisions.isError}
            onNew={() => {
              setPanelOpen(true);
            }}
            onRetry={() => {
              void decisions.refetch();
            }}
            rows={decisions.rows}
          />
        </TabsContent>
        <TabsContent className="flex flex-col gap-4" value="lab">
          <ScenariosSection
            isError={scenarios.isError}
            onRetry={() => {
              void scenarios.refetch();
            }}
            rows={scenarios.rows}
          />
        </TabsContent>
      </Tabs>
      <NewTransactionPanel
        onOpenChange={setPanelOpen}
        onRecorded={announceRecorded}
        open={panelOpen}
        portfolioId={portfolioId}
      />
    </>
  );
}
