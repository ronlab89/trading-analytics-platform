import { createColumnHelper } from "@tanstack/react-table";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { DataTable } from "./data-table";
import { DataTableToolbar } from "./data-table-toolbar";
import type { DataTableFeatures } from "./data-table-features";
import { useDataTable } from "./use-data-table";

interface Person {
  id: string;
  name: string;
  team: string;
}

const helper = createColumnHelper<DataTableFeatures, Person>();
const columns = helper.columns([
  helper.accessor("name", { header: "Name", meta: { rowHeader: true } }),
  helper.accessor("team", { header: "Team", enableGlobalFilter: false }),
]);

const people: Person[] = [
  { id: "g", name: "Grace", team: "Navy" },
  { id: "a", name: "Ada", team: "Analytical" },
  { id: "e", name: "Éowyn", team: "Rohan" },
];

function PeopleTable({ disabled }: { disabled?: boolean }) {
  const table = useDataTable({ columns, data: people, getRowId: (person) => person.id });
  return (
    <>
      <DataTableToolbar disabled={disabled} searchLabel="Search people" table={table}>
        <p>{table.getRowModel().rows.length} people</p>
      </DataTableToolbar>
      <DataTable aria-label="People" table={table} />
    </>
  );
}

const names = () => screen.getAllByRole("rowheader").map((cell) => cell.textContent);
const search = () => screen.getByRole("searchbox", { name: "Search people" });

describe("DataTableToolbar", () => {
  it("shows every row until the user searches", () => {
    render(<PeopleTable />);

    expect(names()).toEqual(["Grace", "Ada", "Éowyn"]);
    expect(search()).toHaveValue("");
  });

  it("narrows the rows of the table as the user types, ignoring case and accents", async () => {
    render(<PeopleTable />);

    await userEvent.type(search(), "EOW");

    expect(names()).toEqual(["Éowyn"]);
    expect(search()).toHaveValue("EOW");
  });

  it("shows no rows when nothing matches, and all of them again when the search is cleared", async () => {
    render(<PeopleTable />);

    await userEvent.type(search(), "zzz");
    expect(screen.queryAllByRole("rowheader")).toHaveLength(0);

    await userEvent.clear(search());
    expect(names()).toEqual(["Grace", "Ada", "Éowyn"]);
  });

  it("does not search a column that opts out", async () => {
    render(<PeopleTable />);

    await userEvent.type(search(), "Navy");

    expect(screen.queryAllByRole("rowheader")).toHaveLength(0);
  });

  it("renders what the view puts at its right, and keeps it in step with the search", async () => {
    render(<PeopleTable />);
    expect(screen.getByText("3 people")).toBeInTheDocument();

    await userEvent.type(search(), "gr");

    expect(screen.getByText("1 people")).toBeInTheDocument();
  });

  it("waits disabled when the view says so", () => {
    render(<PeopleTable disabled />);

    expect(search()).toBeDisabled();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<PeopleTable />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
