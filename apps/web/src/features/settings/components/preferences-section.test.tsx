import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { DEFAULT_LANGUAGE } from "@/i18n/resources";
import { useLanguageStore } from "@/stores/language-store";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { PreferencesSection } from "./preferences-section";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const portfolio = (id: string, name: string, status = "ACTIVE") => ({
  id,
  userId: "u1",
  name,
  description: null,
  baseCurrency: "USD",
  status,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
});

const saved = {
  userId: "u1",
  theme: "light",
  language: "es",
  defaultPortfolioId: "p1",
  reducedMotion: true,
  notificationPreferences: {},
  updatedAt: "2026-11-01T10:00:00.000Z",
};

type Answers = Partial<Record<string, (input?: CallInput) => Promise<unknown>>>;

function clientWith(answers: Answers = {}) {
  const base: Answers = {
    getPreferences: () => Promise.resolve({ data: saved }),
    listPortfolios: () =>
      Promise.resolve({
        data: [
          portfolio("p1", "Growth"),
          portfolio("p2", "Income"),
          portfolio("p3", "Old", "ARCHIVED"),
        ],
      }),
    updatePreferences: (input) =>
      Promise.resolve({
        data: { ...saved, ...(input?.body as object), updatedAt: "2026-11-04T10:00:00.000Z" },
      }),
    ...answers,
  };
  const call = vi.fn((operation: { operationId: string }, input?: CallInput) => {
    const answer = base[operation.operationId];
    return answer === undefined
      ? Promise.reject(new Error(`unexpected ${operation.operationId}`))
      : answer(input);
  });
  const updates = () =>
    call.mock.calls
      .filter(([operation]) => operation.operationId === "updatePreferences")
      .map(([, input]) => input?.body);
  return { client: { call } as unknown as TradingClient, updates };
}

function renderSection(client: TradingClient) {
  const Wrapper = tradingClientWrapper(client);
  return render(
    <Wrapper>
      <PreferencesSection />
    </Wrapper>,
  );
}

const loaded = () => screen.findByRole("combobox", { name: "Language" }, { timeout: 4000 });
const save = () => screen.getByRole("button", { name: /^(Save changes|Try again)$/ });
const discard = () => screen.getByRole("button", { name: "Discard" });

async function chooseLanguage(name: string) {
  await userEvent.click(screen.getByRole("combobox", { name: "Language" }));
  await userEvent.click(await screen.findByRole("option", { name }));
}

beforeEach(() => {
  useLanguageStore.setState({ language: DEFAULT_LANGUAGE });
  vi.mocked(toast.success).mockClear();
});

describe("PreferencesSection", () => {
  it("shows what the user saved, with nothing to save yet", async () => {
    renderSection(clientWith().client);

    expect(await loaded()).toHaveTextContent("Español");
    expect(screen.getByRole("combobox", { name: "Default portfolio" })).toHaveTextContent("Growth");
    expect(screen.getByRole("checkbox", { name: /Reduce motion/ })).toBeChecked();
    expect(save()).toBeDisabled();
    expect(discard()).toBeDisabled();
  });

  it("starts from the language in use and no default portfolio when nothing was saved", async () => {
    renderSection(clientWith({ getPreferences: () => Promise.resolve({ data: null }) }).client);

    expect(await loaded()).toHaveTextContent("English");
    expect(screen.getByRole("combobox", { name: "Default portfolio" })).toHaveTextContent(
      "No default portfolio",
    );
    expect(screen.getByRole("checkbox", { name: /Reduce motion/ })).not.toBeChecked();
  });

  it("offers the active portfolios and not the archived ones", async () => {
    renderSection(clientWith().client);
    await loaded();

    await userEvent.click(screen.getByRole("combobox", { name: "Default portfolio" }));
    const options = within(await screen.findByRole("listbox")).getAllByRole("option");

    expect(options.map((option) => option.textContent)).toEqual([
      "No default portfolio",
      "Growth",
      "Income",
    ]);
  });

  it("lets a change be saved or discarded, and discarding puts everything back", async () => {
    renderSection(clientWith().client);
    await loaded();

    await chooseLanguage("English");
    await userEvent.click(screen.getByRole("checkbox", { name: /Reduce motion/ }));

    expect(save()).toBeEnabled();
    await userEvent.click(discard());

    expect(screen.getByRole("combobox", { name: "Language" })).toHaveTextContent("Español");
    expect(screen.getByRole("checkbox", { name: /Reduce motion/ })).toBeChecked();
    expect(save()).toBeDisabled();
  });

  it("saves only what changed, says so and has nothing left to save", async () => {
    const { client, updates } = clientWith();
    renderSection(client);
    await loaded();

    await userEvent.click(screen.getByRole("checkbox", { name: /Reduce motion/ }));
    await userEvent.click(save());

    await waitFor(() => {
      expect(updates()).toEqual([{ reducedMotion: false }]);
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Preferences saved", expect.anything());
    });
    await waitFor(() => {
      expect(save()).toBeDisabled();
    });
    expect(screen.getByRole("checkbox", { name: /Reduce motion/ })).not.toBeChecked();
  });

  it("clears the default portfolio with null when the user picks none", async () => {
    const { client, updates } = clientWith();
    renderSection(client);
    await loaded();

    await userEvent.click(screen.getByRole("combobox", { name: "Default portfolio" }));
    await userEvent.click(await screen.findByRole("option", { name: "No default portfolio" }));
    await userEvent.click(save());

    await waitFor(() => {
      expect(updates()).toEqual([{ defaultPortfolioId: null }]);
    });
  });

  it("says it could not save, keeps the change and tries again on the same button", async () => {
    const updatePreferences = vi
      .fn<(input?: CallInput) => Promise<unknown>>()
      .mockRejectedValueOnce(new ApiError("NETWORK_ERROR", "offline"))
      .mockResolvedValue({ data: { ...saved, reducedMotion: false } });
    const { client } = clientWith({ updatePreferences });
    renderSection(client);
    await loaded();

    await userEvent.click(screen.getByRole("checkbox", { name: /Reduce motion/ }));
    await userEvent.click(save());

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't save your changes");
    expect(screen.getByRole("checkbox", { name: /Reduce motion/ })).not.toBeChecked();
    expect(save()).toHaveTextContent("Try again");

    await userEvent.click(save());

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
    expect(updatePreferences).toHaveBeenCalledTimes(2);
    expect(updatePreferences).toHaveBeenLastCalledWith({ body: { reducedMotion: false } });
  });

  it("drops the error when the user discards", async () => {
    renderSection(
      clientWith({
        updatePreferences: () => Promise.reject(new ApiError("NETWORK_ERROR", "offline")),
      }).client,
    );
    await loaded();

    await userEvent.click(screen.getByRole("checkbox", { name: /Reduce motion/ }));
    await userEvent.click(save());
    await screen.findByRole("alert");

    await userEvent.click(discard());

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(save()).toHaveTextContent("Save changes");
  });

  it("holds the place of the form while it loads", () => {
    renderSection(clientWith({ getPreferences: () => new Promise(() => undefined) }).client);

    expect(screen.getByRole("status", { name: "Loading your preferences" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("says it could not load them and asks again on retry", async () => {
    const getPreferences = vi
      .fn<(input?: CallInput) => Promise<unknown>>()
      .mockRejectedValueOnce(new ApiError("NETWORK_ERROR", "offline"))
      .mockResolvedValue({ data: saved });
    renderSection(clientWith({ getPreferences }).client);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load your preferences");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await loaded()).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderSection(clientWith().client);
    await loaded();

    expect(await axe(container)).toHaveNoViolations();
  });
});
