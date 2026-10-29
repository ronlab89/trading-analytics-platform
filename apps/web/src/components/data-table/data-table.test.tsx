import { createColumnHelper } from "@tanstack/react-table";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { DataTable } from "./data-table";
import type { DataTableFeatures } from "./data-table-features";
import { useDataTable } from "./use-data-table";

interface Person {
  id: string;
  name: string;
  age: number;
  team: string;
}

const helper = createColumnHelper<DataTableFeatures, Person>();
const columns = helper.columns([
  helper.accessor("name", { header: "Name", meta: { rowHeader: true } }),
  helper.accessor("age", {
    header: "Age",
    meta: { align: "end" },
    cell: (info) => `${String(info.getValue())} years`,
  }),
  helper.accessor("team", { header: "Team", enableSorting: false }),
]);

const people: Person[] = [
  { id: "g", name: "Grace", age: 45, team: "Navy" },
  { id: "a", name: "Ada", age: 36, team: "Analytical" },
  { id: "l", name: "Linus", age: 28, team: "Kernel" },
];

function PeopleTable({ data, sortable }: { data: Person[]; sortable?: boolean }) {
  const table = useDataTable({ columns, data, getRowId: (person) => person.id, sortable });
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
    ).toEqual(["Name", "Age", "Team"]);
    expect(within(table).getAllByRole("row")).toHaveLength(4);
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

  describe("sorting", () => {
    const names = () => screen.getAllByRole("rowheader").map((cell) => cell.textContent);

    it("is off unless the view asks for it: no buttons, no aria-sort", () => {
      render(<PeopleTable data={people} />);

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Name" })).not.toHaveAttribute("aria-sort");
      expect(names()).toEqual(["Grace", "Ada", "Linus"]);
    });

    it("sorts by a column ascending, then descending, then back to the order it came in", async () => {
      render(<PeopleTable data={people} sortable />);
      const sortByName = screen.getByRole("button", { name: "Name" });
      const header = screen.getByRole("columnheader", { name: "Name" });
      expect(header).toHaveAttribute("aria-sort", "none");

      await userEvent.click(sortByName);
      expect(names()).toEqual(["Ada", "Grace", "Linus"]);
      expect(header).toHaveAttribute("aria-sort", "ascending");

      await userEvent.click(sortByName);
      expect(names()).toEqual(["Linus", "Grace", "Ada"]);
      expect(header).toHaveAttribute("aria-sort", "descending");

      await userEvent.click(sortByName);
      expect(names()).toEqual(["Grace", "Ada", "Linus"]);
      expect(header).toHaveAttribute("aria-sort", "none");
    });

    it("sorts numbers by value, not as text", async () => {
      render(
        <PeopleTable
          data={[...people, { id: "m", name: "Maria", age: 100, team: "X" }]}
          sortable
        />,
      );

      await userEvent.click(screen.getByRole("button", { name: "Age" }));

      expect(names()).toEqual(["Linus", "Ada", "Grace", "Maria"]);
    });

    it("leaves out the column that opts out", () => {
      render(<PeopleTable data={people} sortable />);

      expect(screen.queryByRole("button", { name: "Team" })).not.toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Team" })).not.toHaveAttribute("aria-sort");
    });

    it("has no accessibility violations", async () => {
      const { container } = render(<PeopleTable data={people} sortable />);

      expect(await axe(container)).toHaveNoViolations();
    });
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<PeopleTable data={people} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
