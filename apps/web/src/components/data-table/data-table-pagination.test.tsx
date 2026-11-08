import { createColumnHelper } from "@tanstack/react-table";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import { DataTable } from "./data-table";
import { DataTablePagination } from "./data-table-pagination";
import type { DataTableFeatures } from "./data-table-features";
import { DataTableToolbar } from "./data-table-toolbar";
import { useDataTable } from "./use-data-table";

interface Person {
  id: string;
  name: string;
}

const helper = createColumnHelper<DataTableFeatures, Person>();
const columns = helper.columns([
  helper.accessor("name", { header: "Name", meta: { rowHeader: true } }),
]);

const people: Person[] = ["Ada", "Alan", "Grace", "Linus", "Margaret"].map((name) => ({
  id: name,
  name,
}));

function PeopleTable({ pageSize }: { pageSize?: number }) {
  const table = useDataTable({ columns, data: people, getRowId: (person) => person.id, pageSize });
  return (
    <>
      <DataTableToolbar searchLabel="Search people" table={table} />
      <DataTable aria-label="People" table={table} />
      <DataTablePagination table={table} />
    </>
  );
}

const names = () => screen.getAllByRole("rowheader").map((cell) => cell.textContent);
const next = () => screen.getByRole("button", { name: "Next page" });
const previous = () => screen.getByRole("button", { name: "Previous page" });

describe("DataTablePagination", () => {
  it("shows only the first page, with which rows are shown out of how many", () => {
    render(<PeopleTable pageSize={2} />);

    expect(names()).toEqual(["Ada", "Alan"]);
    expect(screen.getByText("Showing 1–2 of 5")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
  });

  it("moves between pages, and the buttons stop at the first and the last", async () => {
    render(<PeopleTable pageSize={2} />);
    expect(previous()).toBeDisabled();

    await userEvent.click(next());
    expect(names()).toEqual(["Grace", "Linus"]);
    expect(screen.getByText("Showing 3–4 of 5")).toBeInTheDocument();
    expect(previous()).toBeEnabled();

    await userEvent.click(next());
    expect(names()).toEqual(["Margaret"]);
    expect(screen.getByText("Showing 5–5 of 5")).toBeInTheDocument();
    expect(screen.getByText("Page 3 of 3")).toBeInTheDocument();
    expect(next()).toBeDisabled();

    await userEvent.click(previous());
    expect(names()).toEqual(["Grace", "Linus"]);
  });

  it("counts the rows the search leaves, and goes back to the first page when the search changes", async () => {
    render(<PeopleTable pageSize={2} />);
    await userEvent.click(next());
    await userEvent.click(next());

    await userEvent.type(screen.getByRole("searchbox", { name: "Search people" }), "a");

    expect(names()).toEqual(["Ada", "Alan"]);
    expect(screen.getByText("Showing 1–2 of 4")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
  });

  it("draws nothing when no row matches", async () => {
    render(<PeopleTable pageSize={2} />);

    await userEvent.type(screen.getByRole("searchbox", { name: "Search people" }), "zzz");

    expect(screen.queryByRole("navigation", { name: "Pagination" })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Showing/)).not.toBeInTheDocument();
  });

  it("leaves a table without a page size unpaginated: every row, in one page", () => {
    render(<PeopleTable />);

    expect(names()).toHaveLength(5);
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<PeopleTable pageSize={2} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
