import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import { NotFoundPage } from "@/pages/not-found/not-found-page";

function renderPage() {
  return render(
    <MemoryRouter>
      <NotFoundPage />
    </MemoryRouter>,
  );
}

describe("NotFoundPage", () => {
  it("renders the title and a link back to the home page", () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/");
  });

  it("has no accessibility violations", async () => {
    const { container } = renderPage();

    expect(await axe(container)).toHaveNoViolations();
  });
});
