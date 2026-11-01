import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./badge";

describe("Badge", () => {
  it.each(["neutral", "success", "warning", "error"] as const)(
    "paints the %s tone with its own subtle tokens by default",
    (tone) => {
      render(<Badge tone={tone}>Label</Badge>);

      const badge = screen.getByText("Label");
      expect(badge.className).toContain(`--color-badge-${tone}-subtle-background`);
      expect(badge.className).toContain(`--color-badge-${tone}-subtle-foreground`);
    },
  );

  it.each(["warning", "error"] as const)("paints the solid style of the %s tone", (tone) => {
    render(
      <Badge style="solid" tone={tone}>
        Label
      </Badge>,
    );

    const badge = screen.getByText("Label");
    expect(badge.className).toContain(`--color-badge-${tone}-solid-background`);
    expect(badge.className).toContain(`--color-badge-${tone}-solid-foreground`);
  });
});
