import { Search } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityFilterChips } from "@/features/activity/components/activity-filter-chips";
import { ActivityFiltersButton } from "@/features/activity/components/activity-filters-button";
import { ActivityList } from "@/features/activity/components/activity-list";
import { ACTIVITY_DAYS } from "@/features/activity/hooks/use-recent-transactions";
import { useActivityEvents } from "@/features/activity/hooks/use-activity-events";
import {
  filterEvents,
  groupByDay,
  paginateEvents,
  type ActivityEvent,
} from "@/features/activity/lib/activity-events";
import {
  NO_PANEL_FILTERS,
  toActivityFilters,
  type ActivityPanelFilters,
} from "@/features/activity/lib/activity-panel-filters";
import { PortfoliosEmptyState } from "@/features/portfolios/components/portfolios-empty-state";
import { TransactionDetailPanel } from "@/features/transactions/components/transaction-detail-panel";
import { TransactionsPagination } from "@/features/transactions/components/transactions-pagination";
import type { TransactionRow } from "@/features/transactions/types";
import { useIsMobile } from "@/hooks/use-media-query";

const DEFAULT_PAGE_SIZE = 10;

/**
 * The Figma "Actividad": the alerts of the user and the last 30 days of transactions of the active
 * portfolio, by day, with a search and pages. All of it is read whole and narrowed on the client
 * (the API has no feed to ask), so the search and the page live here. The Figma states are all
 * here: loading, with data, empty, no results and failed.
 */
export function ActivityPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { events, transactionRows, isError, retry } = useActivityEvents();
  const [search, setSearch] = useState("");
  const [panel, setPanel] = useState(NO_PANEL_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  // The transaction whose detail is open; the hook already holds everything the panel shows.
  const [viewing, setViewing] = useState<TransactionRow | null>(null);

  const filtered = events ? filterEvents(events, toActivityFilters(panel, search)) : [];
  const current = paginateEvents(filtered, page, pageSize);

  const changeSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  // Other filters are another list, so it starts on its first page.
  const changePanel = (next: ActivityPanelFilters) => {
    setPanel(next);
    setPage(1);
  };

  const clearAll = () => {
    setSearch("");
    changePanel(NO_PANEL_FILTERS);
  };

  const changePageSize = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  const renderAction = (event: ActivityEvent) => {
    const row =
      event.transactionId === undefined ? undefined : transactionRows.get(event.transactionId);
    if (row === undefined) return null;
    return (
      <Button
        onClick={() => {
          setViewing(row);
        }}
        size="sm"
        variant="ghost"
      >
        {t("activity.viewTransaction")}
      </Button>
    );
  };

  return (
    <div className="flex flex-col gap-4 desktop:gap-6">
      <div className="flex flex-col gap-1">
        <h1
          className={
            isMobile ? "text-2xl leading-8 font-semibold text-(--color-text-default)" : "sr-only"
          }
        >
          {t("nav.activity")}
        </h1>
        {events !== undefined ? (
          <p className="text-sm text-(--color-text-secondary)">
            {t("activity.summary", { count: events.length, days: ACTIVITY_DAYS })}
          </p>
        ) : null}
      </div>
      {isError ? (
        <Alert
          action={
            <Button onClick={retry} size="sm" variant="outline">
              {t("activity.failed.retry")}
            </Button>
          }
          description={t("activity.failed.description")}
          title={t("activity.failed.title")}
          tone="error"
        />
      ) : events === undefined ? (
        <div
          aria-label={t("activity.loading")}
          className="flex flex-col gap-3 rounded-xl bg-(--color-surface-card) p-5"
          role="status"
        >
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : events.length === 0 ? (
        <section className="rounded-xl bg-(--color-surface-card) p-6">
          <PortfoliosEmptyState
            description={t("activity.empty.description")}
            title={t("activity.empty.title")}
          />
        </section>
      ) : (
        <section className="flex flex-col gap-4 rounded-xl bg-(--color-surface-card) p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-70 max-w-full max-tablet:w-full">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-(--color-text-secondary)"
              />
              <Input
                aria-label={t("activity.search")}
                className="pl-9"
                onChange={(event) => {
                  changeSearch(event.target.value);
                }}
                placeholder={t("activity.search")}
                type="search"
                value={search}
              />
            </div>
            <ActivityFiltersButton onApply={changePanel} value={panel} />
          </div>
          <ActivityFilterChips onChange={changePanel} value={panel} />
          {current.total === 0 ? (
            <PortfoliosEmptyState
              action={
                <Button onClick={clearAll} size="sm" variant="outline">
                  {t("activity.noResults.clear")}
                </Button>
              }
              description={
                search.trim() === ""
                  ? t("activity.noResults.descriptionFilters")
                  : t("activity.noResults.description", { query: search.trim() })
              }
              title={t("activity.noResults.title")}
            />
          ) : (
            <>
              <ActivityList
                days={groupByDay(current.items, new Date())}
                renderAction={renderAction}
              />
              <TransactionsPagination
                meta={{
                  page: current.page,
                  pageSize,
                  total: current.total,
                  totalPages: current.pageCount,
                }}
                onPageChange={setPage}
                onPageSizeChange={changePageSize}
                shown={current.items.length}
              />
            </>
          )}
        </section>
      )}
      <TransactionDetailPanel
        onClose={() => {
          setViewing(null);
        }}
        transaction={viewing}
      />
    </div>
  );
}
