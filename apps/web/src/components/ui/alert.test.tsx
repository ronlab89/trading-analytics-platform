import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { Alert } from "./alert";
import { Button } from "./button";

describe("Alert", () => {
  it("shows the title and the description", () => {
    render(
      <Alert tone="error" title="Wrong email or password" description="Check your details." />,
    );

    expect(screen.getByText("Wrong email or password")).toBeInTheDocument();
    expect(screen.getByText("Check your details.")).toBeInTheDocument();
  });

  it("shows only the title when there is no description", () => {
    render(<Alert tone="info" title="Heads up" />);

    expect(screen.getByRole("status")).toHaveTextContent("Heads up");
  });

  it("is announced right away for an error", () => {
    render(<Alert tone="error" title="Service unavailable" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Service unavailable");
  });

  it.each(["info", "success", "warning"] as const)("is announced politely for %s", (tone) => {
    render(<Alert tone={tone} title="Notice" />);

    expect(screen.getByRole("status")).toHaveTextContent("Notice");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("lets the caller choose the role", () => {
    render(<Alert tone="warning" title="You are offline" role="alert" />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("hosts an action the user can press", async () => {
    const onRetry = vi.fn();
    render(
      <Alert
        tone="error"
        title="Service unavailable"
        action={
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        }
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("keeps the decorative icon out of the accessibility tree", () => {
    const { container } = render(<Alert tone="success" title="Saved" />);

    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it.each(["info", "success", "warning", "error"] as const)(
    "has no accessibility violations as %s",
    async (tone) => {
      const { container } = render(
        <Alert
          tone={tone}
          title="Title"
          description="Description"
          action={<Button size="sm">Action</Button>}
        />,
      );

      expect(await axe(container)).toHaveNoViolations();
    },
  );
});
