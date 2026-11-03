import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { ApiError } from "@/api/trading-client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DecisionDetail } from "@/features/decisions/components/decision-detail";
import { DecisionDetailSkeleton } from "@/features/decisions/components/decision-detail-skeleton";
import { useDecisionReplay } from "@/features/decisions/hooks/use-decision-replay";
import { useAssets } from "@/hooks/use-assets";
import { useIsMobile } from "@/hooks/use-media-query";
import { NotFoundPage } from "@/pages/not-found/not-found-page";

const NO_ASSET_IDS: readonly string[] = [];

/**
 * One decision of the Decision Center. A decision that does not exist (or is not the user's) gets
 * the global not-found page; a failed request is an alert with a retry, with the way back to the
 * list. The page waits for the asset so the header never flashes an unknown name, and an asset that
 * fails to load does not stop the page.
 */
export function DecisionDetailPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { decisionId } = useParams();
  const replay = useDecisionReplay(decisionId);
  const assetId = replay.data?.decision.assetId;
  const { assets, isPending: assetsPending } = useAssets(
    assetId === undefined ? NO_ASSET_IDS : [assetId],
  );

  if (replay.error instanceof ApiError && replay.error.status === 404) {
    return <NotFoundPage />;
  }

  const asset = assetId === undefined ? undefined : assets.get(assetId);

  return (
    <div className="flex flex-col gap-4 desktop:gap-6">
      <h1
        className={
          isMobile ? "text-2xl leading-8 font-semibold text-(--color-text-default)" : "sr-only"
        }
      >
        {replay.data?.decision.title ?? t("nav.decisions")}
      </h1>
      {replay.isError ? (
        <>
          <Link className="text-sm text-(--color-text-default) hover:underline" to="/decisions">
            {t("decisions.detail.back")}
          </Link>
          <Alert
            action={
              <Button
                onClick={() => {
                  void replay.refetch();
                }}
                size="sm"
                variant="outline"
              >
                {t("decisions.failed.retry")}
              </Button>
            }
            description={t("decisions.detail.failed.description")}
            title={t("decisions.detail.failed.title")}
            tone="error"
          />
        </>
      ) : replay.data === undefined || assetsPending ? (
        <DecisionDetailSkeleton />
      ) : (
        <DecisionDetail asset={asset ?? null} replay={replay.data} />
      )}
    </div>
  );
}
