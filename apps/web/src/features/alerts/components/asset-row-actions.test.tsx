import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "@/i18n";
import { AssetRowActions } from "./asset-row-actions";

const apple = { assetId: "a1", symbol: "AAPL", name: "Apple Inc." };

describe("AssetRowActions", () => {
  it("draws the row's own action, and a bell before it", () => {
    render(
      <AssetRowActions asset={apple} onCreateAlert={vi.fn()}>
        <button type="button">Star</button>
      </AssetRowActions>,
    );

    const [bell, star] = screen.getAllByRole("button");
    expect(bell).toHaveAccessibleName("Create an alert for AAPL");
    expect(star).toHaveAccessibleName("Star");
  });

  it("asks to create an alert for the asset of the row", async () => {
    const onCreateAlert = vi.fn();
    render(
      <AssetRowActions asset={apple} onCreateAlert={onCreateAlert}>
        <button type="button">Star</button>
      </AssetRowActions>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Create an alert for AAPL" }));

    expect(onCreateAlert).toHaveBeenCalledExactlyOnceWith("a1");
  });

  it("has no bell when nothing can create the alert", () => {
    render(
      <AssetRowActions asset={apple}>
        <button type="button">Star</button>
      </AssetRowActions>,
    );

    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("names the asset by its name when it has no symbol, and says unknown when it has neither", () => {
    render(
      <>
        <AssetRowActions
          asset={{ assetId: "a2", symbol: null, name: "Coca-Cola" }}
          onCreateAlert={vi.fn()}
        >
          <span />
        </AssetRowActions>
        <AssetRowActions
          asset={{ assetId: "a3", symbol: null, name: null }}
          onCreateAlert={vi.fn()}
        >
          <span />
        </AssetRowActions>
      </>,
    );

    expect(screen.getByRole("button", { name: "Create an alert for Coca-Cola" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Create an alert for Unknown asset" })).toBeVisible();
  });
});
