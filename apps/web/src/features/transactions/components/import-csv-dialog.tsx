import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useTrackedJobs } from "@/features/jobs/hooks/use-tracked-jobs";
import { ImportChooseStep } from "./import-choose-step";
import { ImportProgressStep } from "./import-progress-step";

interface ImportCsvDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portfolioId: string;
  /** Opens on the progress of this job instead of the step to choose a file. */
  jobId?: string;
}

/**
 * The CSV import dialog, a bottom sheet on a phone. It has two steps: choose the file and send it,
 * then follow the job the API queued. While the file is being sent it cannot be dismissed, since
 * the job would be lost; once queued it can, and the job goes on without the window. Closing it
 * starts the next opening from the first step.
 */
export function ImportCsvDialog({
  open,
  onOpenChange,
  portfolioId,
  jobId: initialJobId,
}: ImportCsvDialogProps) {
  const [startedJobId, setJobId] = useState<string | null>(null);
  const jobId = startedJobId ?? initialJobId ?? null;
  const [sending, setSending] = useState(false);
  const { track } = useTrackedJobs();

  return (
    <Dialog
      onOpenChange={(next) => {
        if (sending && !next) return;
        if (!next) setJobId(null);
        onOpenChange(next);
      }}
      open={open}
    >
      <DialogContent aria-describedby={undefined} mobileSheet>
        {jobId === null ? (
          <ImportChooseStep
            onBusyChange={setSending}
            onQueued={(job, fileName) => {
              // The job goes on without the window, so the registry is how Activity finds it again.
              track({
                id: job.id,
                portfolioId: job.portfolioId,
                fileName,
                startedAt: job.createdAt,
              });
              setJobId(job.id);
            }}
            portfolioId={portfolioId}
          />
        ) : (
          <ImportProgressStep jobId={jobId} />
        )}
      </DialogContent>
    </Dialog>
  );
}
