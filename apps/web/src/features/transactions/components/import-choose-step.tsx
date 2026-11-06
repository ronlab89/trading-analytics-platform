import type { JobResponse } from "@trading/contracts";
import type { TFunction } from "i18next";
import { FileText } from "lucide-react";
import { useEffect, useEffectEvent, useId, useState, type DragEvent } from "react";
import { useTranslation } from "react-i18next";
import { rejectionReason } from "@/api/rejection-reason";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DialogBody,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { downloadTextFile } from "@/lib/download-text-file";
import { cn } from "@/lib/utils";
import { useImportCsv } from "../hooks/use-import-csv";
import {
  checkImportFile,
  type ImportFileCheck,
  type ImportFileProblem,
} from "../lib/check-import-file";
import { importTemplate } from "../lib/import-template";

type Selection =
  { name: string; text: string; check: ImportFileCheck } | { name: string; unreadable: true };

function problemMessage(problem: ImportFileProblem, t: TFunction): string {
  switch (problem.kind) {
    case "too-large":
      return t("importCsv.choose.problem.tooLarge");
    case "empty":
      return t("importCsv.choose.problem.empty");
    case "missing-columns":
      return t("importCsv.choose.problem.missingColumns", { columns: problem.columns.join(", ") });
    case "unknown-columns":
      return t("importCsv.choose.problem.unknownColumns", { columns: problem.columns.join(", ") });
    case "too-many-rows":
      return t("importCsv.choose.problem.tooManyRows");
  }
}

interface ImportChooseStepProps {
  portfolioId: string;
  /** Called with the job the API queued and the name of the file sent, where the import goes on. */
  onQueued: (job: JobResponse, fileName: string) => void;
  /** Told whenever the file is being sent, so the dialog can refuse to close meanwhile. */
  onBusyChange?: ((busy: boolean) => void) | undefined;
}

/**
 * The first step of the import dialog: pick a CSV (or drop it), see at once whether it can be
 * sent, and send it. The file is checked in the browser against the limits and the header the API
 * applies, so a wrong file is told before anything travels; the contents of each row are the job's
 * to check. Sending locks the step: neither the file nor "Cancel" can change until the API answers.
 */
export function ImportChooseStep({ portfolioId, onQueued, onBusyChange }: ImportChooseStepProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const importCsv = useImportCsv(portfolioId);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [dragging, setDragging] = useState(false);

  const pending = importCsv.isPending;
  const reportBusy = useEffectEvent((busy: boolean) => onBusyChange?.(busy));
  useEffect(() => {
    reportBusy(pending);
  }, [pending]);
  const rejection = rejectionReason(importCsv.error);
  const ready = selection !== null && "check" in selection && selection.check.ok;

  async function pick(file: File | undefined) {
    if (file === undefined || pending) return;
    importCsv.reset();
    try {
      const text = await file.text();
      setSelection({ name: file.name, text, check: checkImportFile(text, file.size) });
    } catch {
      setSelection({ name: file.name, unreadable: true });
    }
  }

  function send() {
    if (selection === null || !("check" in selection) || !selection.check.ok) return;
    const { name, text } = selection;
    importCsv.mutate(text, {
      onSuccess: (queued) => {
        onQueued(queued, name);
      },
    });
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void pick(event.dataTransfer.files[0]);
  }

  const problem =
    selection === null
      ? null
      : "unreadable" in selection
        ? t("importCsv.choose.problem.unreadable")
        : selection.check.ok
          ? null
          : problemMessage(selection.check.problem, t);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("importCsv.title")}</DialogTitle>
      </DialogHeader>
      <DialogBody className="flex-1 gap-4">
        <p className="text-sm leading-5 text-(--color-text-secondary)">
          {t("importCsv.choose.intro")}
        </p>
        <p className="text-sm leading-5 text-(--color-text-secondary)">
          {t("importCsv.choose.columns")}
        </p>
        {importCsv.isError ? (
          <Alert
            action={
              rejection === null ? (
                <Button onClick={send} size="sm" type="button" variant="outline">
                  {t("importCsv.choose.failed.retry")}
                </Button>
              ) : null
            }
            description={rejection ?? t("importCsv.choose.failed.description")}
            title={t("importCsv.choose.failed.title")}
            tone="error"
          />
        ) : null}
        <div
          className={cn(
            "flex flex-col items-center gap-2 rounded-lg border border-dashed border-(--color-border-input) px-4 py-6 text-center",
            dragging && "border-(--color-border-ring) bg-(--color-surface-secondary)",
          )}
          onDragLeave={() => {
            setDragging(false);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDrop={onDrop}
        >
          <FileText aria-hidden="true" className="size-6 text-(--color-text-secondary)" />
          {selection !== null && "check" in selection && selection.check.ok ? (
            <p className="text-sm font-medium break-all text-(--color-text-default)">
              {t("importCsv.choose.picked", { name: selection.name, count: selection.check.rows })}
            </p>
          ) : (
            <p className="text-sm text-(--color-text-secondary)">
              {t("importCsv.choose.dropzone")}{" "}
              <label
                className="cursor-pointer font-medium text-(--color-brand-brand-text) underline"
                htmlFor={inputId}
              >
                {t("importCsv.choose.browse")}
              </label>
            </p>
          )}
          <input
            accept=".csv,text/csv"
            aria-label={t("importCsv.choose.browse")}
            className="sr-only"
            disabled={pending}
            id={inputId}
            onChange={(event) => {
              void pick(event.target.files?.[0]);
              event.target.value = "";
            }}
            type="file"
          />
          {ready ? (
            <Button
              disabled={pending}
              onClick={() => {
                document.getElementById(inputId)?.click();
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              {t("importCsv.choose.change")}
            </Button>
          ) : null}
        </div>
        {problem === null ? null : (
          <p className="text-sm text-(--color-status-error)" role="alert">
            {problem}
          </p>
        )}
        <Button
          className="self-start"
          onClick={() => {
            downloadTextFile("transactions-template.csv", importTemplate());
          }}
          size="sm"
          type="button"
          variant="ghost"
        >
          {t("importCsv.choose.template")}
        </Button>
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button disabled={pending} type="button" variant="outline">
            {t("importCsv.choose.cancel")}
          </Button>
        </DialogClose>
        <Button disabled={!ready} loading={pending} onClick={send} type="button">
          {t(pending ? "importCsv.choose.submitting" : "importCsv.choose.submit")}
        </Button>
      </DialogFooter>
    </>
  );
}
