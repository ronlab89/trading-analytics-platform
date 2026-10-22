import { JobStatus, NotificationSeverity, validateNewNotification } from "@trading/domain";
import type {
  CreateNotificationInput,
  Job,
  NotificationRepository,
  JobFailureReason,
} from "@trading/domain";

export interface JobNotifier {
  /** Tells the owner how the job ended; does nothing for a job that did not end in a notified state. */
  jobFinished(job: Job): Promise<void>;
}

export interface JobNotifierDependencies {
  notificationRepository: Pick<NotificationRepository, "create">;
}

const FAILURE_MESSAGES: Readonly<Record<JobFailureReason, string>> = {
  VALIDATION_FAILED: "The file has errors. Fix them and import it again.",
  INTERRUPTED: "The import was interrupted. You can retry it.",
  APPLY_ERROR: "The import hit a technical error. You can retry it.",
  APPLY_REJECTED: "The import was rejected because the portfolio changed. You can retry it.",
  PORTFOLIO_ARCHIVED: "The portfolio was archived, so the import was not applied.",
};

/** What a finished job tells its owner, or null when it tells nothing. */
function notificationFor(job: Job): CreateNotificationInput | null {
  const metadata = {
    jobId: job.id,
    portfolioId: job.portfolioId,
    attempt: job.attempt,
    ...(job.failureReason ? { reason: job.failureReason } : {}),
  };

  switch (job.status) {
    case JobStatus.COMPLETED:
      return {
        userId: job.userId,
        type: "JOB_COMPLETED",
        title: "Import completed",
        message: `Imported ${job.total.toString()} transactions.`,
        severity: NotificationSeverity.SUCCESS,
        metadata,
      };
    case JobStatus.FAILED:
      return {
        userId: job.userId,
        type: "JOB_FAILED",
        title: "Import failed",
        message: job.failureReason ? FAILURE_MESSAGES[job.failureReason] : "The import failed.",
        severity: NotificationSeverity.ERROR,
        metadata,
      };
    case JobStatus.TIMED_OUT:
      return {
        userId: job.userId,
        type: "JOB_TIMED_OUT",
        title: "Import timed out",
        message: "The import took too long. You can retry it.",
        severity: NotificationSeverity.ERROR,
        metadata,
      };
    default:
      // `CANCELLED` is caused by the user, so it tells nothing (ADR-008 point 6, ADR-010 point 9).
      return null;
  }
}

/**
 * Creates the notification of a finished job (ADR-008 point 6): `SUCCESS` for
 * `COMPLETED`, `ERROR` for `FAILED` and `TIMED_OUT`, none for `CANCELLED`.
 */
export function createJobNotifier(dependencies: JobNotifierDependencies): JobNotifier {
  const { notificationRepository } = dependencies;

  return {
    async jobFinished(job) {
      const input = notificationFor(job);

      if (!input) {
        return;
      }

      validateNewNotification(input);
      await notificationRepository.create(input);
    },
  };
}
