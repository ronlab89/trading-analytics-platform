import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";

function renderTable() {
  return render(
    <Table aria-label="People" className="extra">
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Ada</TableCell>
        </TableRow>
      </TableBody>
    </Table>,
  );
}

describe("Table", () => {
  it("renders semantic table markup, with a column header for each head cell", () => {
    renderTable();

    expect(screen.getByRole("table", { name: "People" })).toHaveClass("extra");
    expect(screen.getByRole("columnheader", { name: "Name" })).toHaveAttribute("scope", "col");
    expect(screen.getByRole("cell", { name: "Ada" })).toBeInTheDocument();
  });

  it("tints a row on hover with the table row token, as the Figma row does", () => {
    renderTable();

    const [, bodyRow] = screen.getAllByRole("row");
    expect(bodyRow).toHaveClass(
      "in-data-[slot=table-body]:hover:bg-(--color-table-row-background-hover)",
    );
  });

  it("has no accessibility violations", async () => {
    const { container } = renderTable();

    expect(await axe(container)).toHaveNoViolations();
  });
});
