import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import { Button } from "./button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

function OpenDialog({
  onOpenChange,
  size,
  description = "What happens when you confirm.",
}: {
  onOpenChange?: (open: boolean) => void;
  size?: "sm" | "md";
  description?: string | null;
}) {
  return (
    <Dialog defaultOpen {...(onOpenChange ? { onOpenChange } : {})}>
      <DialogContent
        {...(size ? { size } : {})}
        {...(description === null ? { "aria-describedby": undefined } : {})}
      >
        <DialogHeader>
          <DialogTitle>New portfolio</DialogTitle>
          {description === null ? null : <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogBody>
          <p>Dialog content</p>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

describe("Dialog", () => {
  it("is a modal dialog named by its title and described by its description", () => {
    render(<OpenDialog />);

    const dialog = screen.getByRole("dialog", { name: "New portfolio" });

    expect(dialog).toHaveAccessibleDescription("What happens when you confirm.");
    expect(screen.getByText("Dialog content")).toBeInTheDocument();
  });

  it("works without a description", () => {
    const error = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    render(<OpenDialog description={null} />);

    expect(screen.getByRole("dialog", { name: "New portfolio" })).not.toHaveAttribute(
      "aria-describedby",
    );
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("closes from the X button", async () => {
    const onOpenChange = vi.fn();
    render(<OpenDialog onOpenChange={onOpenChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes with Escape", async () => {
    const onOpenChange = vi.fn();
    render(<OpenDialog onOpenChange={onOpenChange} />);

    await userEvent.keyboard("{Escape}");

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes when the user clicks the dimmed page", async () => {
    const onOpenChange = vi.fn();
    render(<OpenDialog onOpenChange={onOpenChange} />);

    const overlay = document.querySelector("[data-slot='dialog-overlay']");
    if (!overlay) {
      throw new Error("The dialog has no overlay");
    }
    await userEvent.click(overlay);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("is 400 px wide by default and 520 px at the md size, as in the Figma", () => {
    const { rerender } = render(<OpenDialog />);
    expect(screen.getByRole("dialog")).toHaveClass("max-w-100");

    rerender(<OpenDialog size="md" />);
    expect(screen.getByRole("dialog")).toHaveClass("max-w-130");
  });

  it("separates the actions from the content with a line, as the Figma footer does", () => {
    render(<OpenDialog />);

    const footer = screen.getByRole("button", { name: "Confirm" }).parentElement;

    expect(footer).toHaveAttribute("data-slot", "dialog-footer");
    expect(footer).toHaveClass("border-t");
  });

  it("returns the focus to what opened it once it closes", async () => {
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New portfolio</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );
    const trigger = screen.getByRole("button", { name: "Open" });

    await userEvent.click(trigger);
    await userEvent.keyboard("{Escape}");

    expect(trigger).toHaveFocus();
  });

  it("has no accessibility violations", async () => {
    render(<OpenDialog />);

    expect(await axe(screen.getByRole("dialog"))).toHaveNoViolations();
  });
});
