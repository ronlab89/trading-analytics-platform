import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

function Example() {
  const [value, setValue] = useState("one");

  return (
    <Tabs onValueChange={setValue} value={value}>
      <TabsList aria-label="Sections">
        <TabsTrigger value="one">One</TabsTrigger>
        <TabsTrigger value="two">Two</TabsTrigger>
      </TabsList>
      <TabsContent value="one">First panel</TabsContent>
      <TabsContent value="two">Second panel</TabsContent>
    </Tabs>
  );
}

describe("Tabs", () => {
  it("shows the panel of the selected tab and marks the tab as selected", () => {
    render(<Example />);

    expect(screen.getByRole("tab", { name: "One", selected: true })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Two", selected: false })).toBeVisible();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("First panel");
  });

  it("changes the panel when another tab is chosen, and renders only that panel", async () => {
    const user = userEvent.setup();
    render(<Example />);

    await user.click(screen.getByRole("tab", { name: "Two" }));

    expect(screen.getByRole("tabpanel")).toHaveTextContent("Second panel");
    expect(screen.queryByText("First panel")).not.toBeInTheDocument();
  });

  it("moves between the tabs with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<Example />);

    await user.tab();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("tab", { name: "Two", selected: true })).toHaveFocus();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<Example />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
