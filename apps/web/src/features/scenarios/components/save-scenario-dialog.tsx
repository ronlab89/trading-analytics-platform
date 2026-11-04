import { zodResolver } from "@hookform/resolvers/zod";
import type { ScenarioResponse } from "@trading/contracts";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { rejectionReason } from "@/api/rejection-reason";
import { Button } from "@/components/ui/button";
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
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateScenario } from "../hooks/use-update-scenario";
import {
  saveScenarioFormSchema,
  toSaveScenarioBody,
  type SaveScenarioFormValues,
} from "../lib/scenario-form";

interface SaveScenarioDialogProps {
  portfolioId: string;
  scenario: ScenarioResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The Figma "Guardar escenario" dialog: a name to find the scenario later and an optional
 * description. Saving marks the scenario as saved, locks the dialog until the API answers, and
 * closes it with a notice; a refusal keeps it open with what the user typed and the reason.
 */
export function SaveScenarioDialog({
  portfolioId,
  scenario,
  open,
  onOpenChange,
}: SaveScenarioDialogProps) {
  const update = useUpdateScenario(portfolioId, scenario.id);

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!update.isPending) onOpenChange(next);
      }}
      open={open}
    >
      <DialogContent aria-describedby={undefined} mobileSheet>
        <SaveScenarioForm
          onSaved={() => {
            onOpenChange(false);
          }}
          scenario={scenario}
          update={update}
        />
      </DialogContent>
    </Dialog>
  );
}

interface SaveScenarioFormProps {
  scenario: ScenarioResponse;
  update: ReturnType<typeof useUpdateScenario>;
  onSaved: () => void;
}

/** Mounted only while the dialog is open, so every opening starts from the scenario's values. */
function SaveScenarioForm({ scenario, update, onSaved }: SaveScenarioFormProps) {
  const { t } = useTranslation();
  const form = useForm<SaveScenarioFormValues>({
    resolver: zodResolver(saveScenarioFormSchema),
    defaultValues: { name: scenario.name, description: scenario.description ?? "" },
  });
  const {
    register,
    formState: { errors },
  } = form;

  const submit = form.handleSubmit((values) => {
    const body = toSaveScenarioBody(saveScenarioFormSchema.parse(values), scenario);
    update.mutate(body, {
      onSuccess: (saved) => {
        toast.success(t("scenarios.save.done.title"), {
          description: t("scenarios.save.done.description", { name: saved.name }),
        });
        onSaved();
      },
      onError: (error) => {
        toast.error(t("scenarios.save.failed.title"), {
          description: rejectionReason(error) ?? t("scenarios.save.failed.description"),
        });
      },
    });
  });

  return (
    <form
      className="flex min-h-0 flex-col"
      noValidate
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <DialogHeader>
        <DialogTitle>{t("scenarios.save.title")}</DialogTitle>
        <DialogDescription>{t("scenarios.save.description")}</DialogDescription>
      </DialogHeader>
      <DialogBody className="gap-4">
        <Field
          disabled={update.isPending}
          error={errors.name ? t("scenarios.save.name.required") : undefined}
          label={t("scenarios.save.name.label")}
          required
        >
          <Input {...register("name")} />
        </Field>
        <Field disabled={update.isPending} label={t("scenarios.save.descriptionField.label")}>
          <Textarea
            className="min-h-9"
            placeholder={t("scenarios.save.descriptionField.placeholder")}
            rows={1}
            {...register("description")}
          />
        </Field>
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button disabled={update.isPending} type="button" variant="outline">
            {t("scenarios.save.cancel")}
          </Button>
        </DialogClose>
        <Button loading={update.isPending} type="submit">
          {update.isPending ? t("scenarios.save.saving") : t("scenarios.save.submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}
