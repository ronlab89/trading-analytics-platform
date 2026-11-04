import { LANGUAGES } from "@trading/contracts";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckboxItem } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortfolios } from "@/hooks/use-portfolios";
import { useLanguageStore } from "@/stores/language-store";
import { usePreferences, useUpdatePreferences } from "../hooks/use-preferences";
import { changesOf, initialDraft, type PreferencesDraft } from "../lib/preferences-form";
import { SettingsCard } from "./settings-card";

/** Radix Select has no empty value, so "no default portfolio" is this one. */
const NO_PORTFOLIO = "none";

/**
 * The Preferences card: the language, the portfolio to open by default and reduced motion. Saving is
 * per card (Figma): the buttons wait for a change, "Descartar" takes everything back, and a failed
 * save keeps the change and turns "Guardar cambios" into "Reintentar".
 */
export function PreferencesSection({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const { t } = useTranslation();
  const preferences = usePreferences();
  const portfolios = usePortfolios();
  const languageInUse = useLanguageStore((state) => state.language);
  const card = {
    title: t("settings.sections.preferences.title"),
    description: t("settings.sections.preferences.description"),
  };

  if (preferences.isError) {
    return (
      <SettingsCard {...card}>
        <Alert
          action={
            <Button
              onClick={() => {
                void preferences.refetch();
              }}
              size="sm"
              variant="outline"
            >
              {t("settings.preferences.retry")}
            </Button>
          }
          description={t("settings.preferences.loadFailed.description")}
          title={t("settings.preferences.loadFailed.title")}
          tone="error"
        />
      </SettingsCard>
    );
  }

  // The default portfolio is shown by name, so the form waits for the list as well as the record.
  if (preferences.isPending || portfolios.isPending) {
    return (
      <SettingsCard {...card}>
        <div
          aria-label={t("settings.preferences.loading")}
          className="flex flex-col gap-4"
          role="status"
        >
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-6 w-2/3" />
        </div>
      </SettingsCard>
    );
  }

  // A new saved record (the update's answer) remounts the form, so it starts again from it.
  return (
    <SettingsCard {...card}>
      <PreferencesForm
        initial={initialDraft(preferences.data, languageInUse)}
        key={preferences.data?.updatedAt ?? "unsaved"}
        onDirtyChange={onDirtyChange}
        portfolios={portfolios.data ?? []}
      />
    </SettingsCard>
  );
}

interface PreferencesFormProps {
  initial: PreferencesDraft;
  /** Tells the page whether there is something to lose, so it can ask before leaving. */
  onDirtyChange: (dirty: boolean) => void;
  portfolios: readonly { id: string; name: string; status: string }[];
}

function PreferencesForm({ initial, portfolios, onDirtyChange }: PreferencesFormProps) {
  const { t } = useTranslation();
  const update = useUpdatePreferences();
  const [draft, setDraft] = useState(initial);

  const changes = changesOf(initial, draft);
  const dirty = Object.keys(changes).length > 0;
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(
    () => () => {
      onDirtyChange(false);
    },
    [onDirtyChange],
  );

  const active = portfolios.filter((portfolio) => portfolio.status === "ACTIVE");

  const change = (next: Partial<PreferencesDraft>) => {
    setDraft((current) => ({ ...current, ...next }));
  };

  const discard = () => {
    setDraft(initial);
    update.reset();
  };

  const save = async () => {
    try {
      await update.mutateAsync(changes);
      toast.success(t("settings.preferences.saved"), {});
    } catch {
      // The failure shows in the card; the change stays so the user can try again.
    }
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (dirty) void save();
      }}
    >
      {update.isError ? (
        <Alert
          description={t("settings.preferences.saveFailed.description")}
          title={t("settings.preferences.saveFailed.title")}
          tone="error"
        />
      ) : null}
      <Field
        description={t("settings.preferences.language.description")}
        label={t("settings.preferences.language.label")}
      >
        <Select
          onValueChange={(language) => {
            const next = LANGUAGES.find((candidate) => candidate === language);
            if (next !== undefined) change({ language: next });
          }}
          value={draft.language}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((language) => (
              <SelectItem key={language} value={language}>
                {t(`settings.preferences.language.options.${language}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field
        description={t("settings.preferences.defaultPortfolio.description")}
        label={t("settings.preferences.defaultPortfolio.label")}
      >
        <Select
          onValueChange={(value) => {
            change({ defaultPortfolioId: value === NO_PORTFOLIO ? null : value });
          }}
          value={draft.defaultPortfolioId ?? NO_PORTFOLIO}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_PORTFOLIO}>
              {t("settings.preferences.defaultPortfolio.none")}
            </SelectItem>
            {active.map((portfolio) => (
              <SelectItem key={portfolio.id} value={portfolio.id}>
                {portfolio.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <CheckboxItem
        checked={draft.reducedMotion}
        description={t("settings.preferences.reducedMotion.description")}
        label={t("settings.preferences.reducedMotion.label")}
        onCheckedChange={(checked) => {
          change({ reducedMotion: checked === true });
        }}
      />
      <div className="flex justify-end gap-2 border-t border-(--color-border-default) pt-4">
        <Button
          disabled={!dirty && !update.isError}
          onClick={discard}
          type="button"
          variant="ghost"
        >
          {t("settings.preferences.discard")}
        </Button>
        <Button disabled={!dirty} loading={update.isPending} type="submit">
          {update.isError ? t("settings.preferences.retry") : t("settings.preferences.save")}
        </Button>
      </div>
    </form>
  );
}
