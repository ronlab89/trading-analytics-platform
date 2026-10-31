import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import { SessionRestoring } from "./session-restoring";

describe("SessionRestoring", () => {
  it("announces that the session is being restored", () => {
    render(<SessionRestoring />);

    expect(screen.getByRole("status")).toHaveTextContent("Restoring your session…");
  });

  it("fills the screen, so nothing of the app shows through while it waits", () => {
    render(<SessionRestoring />);

    expect(screen.getByRole("status").className).toContain("min-h-dvh");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<SessionRestoring />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
