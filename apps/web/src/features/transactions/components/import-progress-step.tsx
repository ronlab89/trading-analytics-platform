import type { JobResponse } from "@trading/contracts";
import { useTranslation } from "react-i18next";
import { rejectionReason } from "@/api/rejection-reason";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/badge";
import { Button } from "@/components/ui/button";
import {
  DialogBody,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useJob } from "@/features/jobs/hooks/use-job";
import { useCancelJob, useRetryJob } from "@/features/jobs/hooks/use-job-actions";
import { canCancelJob, canRetryJob, jobPhase, type JobPhase } from "@/features/jobs/lib/job-state";

const phaseTone = {
  QUEUED: "neutral",
  VALIDATING: "info",
  APPLYING: "info",
  COMPLETED: "success",
  FAILED: "error",
  CANCELLED: "neutral",
  TIMED_OUT: "warning",
} as const satisfies Record<JobPhase, string>;

const outcomeTone = {
  QUEUED: "info",
  PROCESSING: "info",
  COMPLETED: "success",
  FAILED: "error",
  CANCELLED: "info",
  TIMED_OUT: "warning",
} as const satisfies Record<JobResponse["status"], string>;

/** What to tell about a job that ended: its failure reason when it has one, else its status. */
function outcomeKey(
  job: JobResponse,
):
  | "COMPLETED"
  | "CANCELLED"
  | "TIMED_OUT"
  | "FAILED"
  | NonNullable<JobResponse["failureReason"]>
  | null {
  switch (job.status) {
    case "COMPLETED":
    case "CANCELLED":
    case "TIMED_OUT":
      return job.status;
    case "FAILED":
      return job.failureReason ?? "FAILED";
    default:
      return null;
  }
}

interface ImportProgressStepProps {
  jobId: string;
}

/**
 * The second step of the import dialog: follows the job from the queue to its end. The bar and the
 * count come from the job as it is read, the stage tells Validating from Applying, and Cancel is
 * offered only while the API still takes it. A job that ended says how, and one that can be run
 * again offers it. The window may be closed at any time: the job does not depend on it.
 */
export function ImportProgressStep({ jobId }: ImportProgressStepProps) {
  const { t } = useTranslation();
  const { data: job, isError } = useJob(jobId);
  const cancel = useCancelJob(jobId);
  const retry = useRetryJob(jobId);

  const phase = job ? jobPhase(job) : null;
  const acting = cancel.isPending || retry.isPending;
  const actionError = cancel.error ?? retry.error;
  const total = job?.progress.total ?? 0;

  const outcome = job ? outcomeKey(job) : null;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("importCsv.title")}</DialogTitle>
      </DialogHeader>
      <DialogBody className="flex-1 gap-4">
        {isError && job === undefined ? (
          <Alert title={t("importCsv.progress.loadFailed")} tone="error" />
        ) : job === undefined || phase === null ? (
          <div aria-live="polite" role="status">
            <span className="sr-only">{t("importCsv.progress.loading")}</span>
            <Progress label={t("importCsv.progress.loading")} max={1} value={null} />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <Badge tone={phaseTone[phase]}>
                <span aria-live="polite" role="status">
                  {t(`importCsv.progress.phase.${phase}`)}
                </span>
              </Badge>
              <span className="text-sm text-(--color-text-secondary)">
                {t("importCsv.progress.rows", {
                  processed: job.progress.processed,
                  total,
                })}
              </span>
            </div>
            <Progress
              label={t("importCsv.progress.barLabel")}
              max={total}
              value={total > 0 ? job.progress.processed : null}
            />
            {outcome !== null ? (
              <Alert
                description={t(`importCsv.progress.outcome.${outcome}`)}
                title={t(`importCsv.progress.phase.${phase}`)}
                tone={outcomeTone[job.status]}
              />
            ) : (
              <p className="text-sm leading-5 text-(--color-text-secondary)">
                {t("importCsv.progress.background")}
              </p>
            )}
          </>
        )}
        {actionError ? (
          <Alert
            title={rejectionReason(actionError) ?? t("importCsv.progress.actionFailed")}
            tone="error"
          />
        ) : null}
      </DialogBody>
      <DialogFooter>
        {job && canCancelJob(job) ? (
          <Button
            disabled={acting}
            loading={cancel.isPending}
            onClick={() => {
              cancel.mutate();
            }}
            type="button"
            variant="outline"
          >
            {t(cancel.isPending ? "importCsv.progress.cancelling" : "importCsv.progress.cancel")}
          </Button>
        ) : null}
        {job && canRetryJob(job) ? (
          <Button
            disabled={acting}
            loading={retry.isPending}
            onClick={() => {
              retry.mutate();
            }}
            type="button"
            variant="outline"
          >
            {t(retry.isPending ? "importCsv.progress.retrying" : "importCsv.progress.retry")}
          </Button>
        ) : null}
        <DialogClose asChild>
          <Button type="button">{t("importCsv.progress.close")}</Button>
        </DialogClose>
      </DialogFooter>
    </>
  );
}
