import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Skeleton } from "./skeleton";

describe("Skeleton", () => {
  it("is decorative: the region that holds it says what is loading", () => {
    const { container } = render(<Skeleton className="h-3 w-22" />);

    const block = container.firstElementChild;
    expect(block).toHaveAttribute("aria-hidden", "true");
    expect(block).toHaveClass("h-3", "w-22");
  });
});
