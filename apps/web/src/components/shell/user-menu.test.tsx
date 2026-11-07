import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "@/i18n";
import { UserMenu } from "./user-menu";

describe("UserMenu", () => {
  it("names the button with the initials it shows, so its visible text is in its name", () => {
    render(
      <UserMenu initials="RL" name="Ronald Labrador" onSignOut={vi.fn()} onViewProfile={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: "User menu, RL" })).toBeInTheDocument();
  });
});
