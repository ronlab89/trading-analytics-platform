import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@/i18n";
import { TransactionsCardsSkeleton } from "./transactions-cards-skeleton";
import { TransactionsTableSkeleton } from "./transactions-table-skeleton";

describe("TransactionsTableSkeleton", () => {
  it("announces the loading once", () => {
    render(<TransactionsTableSkeleton />);

    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status", { name: "Loading transactions" })).toBeInTheDocument();
  });

  it("keeps the headers of the table and draws ten rows of placeholders", () => {
    const { container } = render(<TransactionsTableSkeleton />);

    ["Date", "Type", "Asset", "Quantity", "Price", "Fees", "Total", "Status"].forEach((header) => {
      expect(screen.getByText(header)).toBeInTheDocument();
    });
    expect(container.querySelectorAll("tbody tr")).toHaveLength(10);
  });
});

describe("TransactionsCardsSkeleton", () => {
  it("announces the loading once", () => {
    render(<TransactionsCardsSkeleton />);

    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status", { name: "Loading transactions" })).toBeInTheDocument();
  });

  it("draws six rows in one card", () => {
    render(<TransactionsCardsSkeleton />);

    expect(screen.getByRole("status").children).toHaveLength(6);
  });
});
