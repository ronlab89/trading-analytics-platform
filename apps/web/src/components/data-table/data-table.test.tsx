import { createColumnHelper } from "@tanstack/react-table";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { DataTable } from "./data-table";
import type { DataTableFeatures } from "./data-table-features";
import { useDataTable } from "./use-data-table";

interface Person {
  id: string;
  name: string;
  age: number;
}

const helper = createColumnHelper<DataTableFeatures, Person>();
const columns = helper.columns([
  helper.accessor("name", { header: "Name", meta: { rowHeader: true } }),
  helper.accessor("age", {
    header: "Age",
    meta: { align: "end" },
    cell: (info) => `${String(info.getValue())} years`,
  }),
]);

const people: Person[] = [
  { id: "a", name: "Ada", age: 36 },
  { id: "g", name: "Grace", age: 45 },
];

function PeopleTable({ data }: { data: Person[] }) {
  const table = useDataTable({ columns, data, getRowId: (person) => person.id });
  return <DataTable aria-label="People" table={table} />;
}

describe("DataTable", () => {
  it("draws a column header for each column and a row for each item", () => {
    render(<PeopleTable data={people} />);

    const table = screen.getByRole("table", { name: "People" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["Name", "Age"]);
    expect(within(table).getAllByRole("row")).toHaveLength(3);
  });

  it("renders each cell with the renderer its column defines", () => {
    render(<PeopleTable data={people} />);

    expect(screen.getByRole("cell", { name: "36 years" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "45 years" })).toBeInTheDocument();
  });

  it("renders the cell of a row-header column as the name of its row", () => {
    render(<PeopleTable data={people} />);

    const row = screen.getByRole("row", { name: /Ada/ });
    expect(within(row).getByRole("rowheader", { name: "Ada" })).toHaveAttribute("scope", "row");
  });

  it("aligns a column, header and cells, as its meta says", () => {
    render(<PeopleTable data={people} />);

    expect(screen.getByRole("columnheader", { name: "Age" })).toHaveClass("text-right");
    expect(screen.getByRole("cell", { name: "36 years" })).toHaveClass("text-right");
    expect(screen.getByRole("columnheader", { name: "Name" })).toHaveClass("text-left");
  });

  it("keeps only the header when there are no rows", () => {
    render(<PeopleTable data={[]} />);

    expect(screen.getAllByRole("row")).toHaveLength(1);
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<PeopleTable data={people} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
