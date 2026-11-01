import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "@/i18n";
import { TransactionsPagination } from "./transactions-pagination";

function renderPagination(props: Partial<Parameters<typeof TransactionsPagination>[0]> = {}) {
  const onPageChange = vi.fn();
  const onPageSizeChange = vi.fn();
  render(
    <TransactionsPagination
      meta={{ page: 2, pageSize: 20, total: 45, totalPages: 3 }}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      shown={20}
      {...props}
    />,
  );
  return { onPageChange, onPageSizeChange };
}

describe("TransactionsPagination", () => {
  it("says which rows are shown out of how many, and the page out of how many", () => {
    renderPagination();

    expect(screen.getByText("Showing 21–40 of 45")).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
  });

  it("counts the rows of a last page that is not full", () => {
    renderPagination({ meta: { page: 3, pageSize: 20, total: 45, totalPages: 3 }, shown: 5 });

    expect(screen.getByText("Showing 41–45 of 45")).toBeInTheDocument();
  });

  it("asks for the next and the previous page", async () => {
    const { onPageChange } = renderPagination();

    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    await userEvent.click(screen.getByRole("button", { name: "Previous page" }));

    expect(onPageChange).toHaveBeenNthCalledWith(1, 3);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 1);
  });

  it("disables the previous button on the first page and the next one on the last", () => {
    renderPagination({ meta: { page: 1, pageSize: 20, total: 45, totalPages: 3 } });
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled();
  });

  it("disables the next button on the last page", () => {
    renderPagination({ meta: { page: 3, pageSize: 20, total: 45, totalPages: 3 }, shown: 5 });
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("shows the rows per page and asks for another size", async () => {
    const { onPageSizeChange } = renderPagination();

    const select = screen.getByRole("combobox", { name: "Rows per page" });
    expect(select).toHaveTextContent("20");

    await userEvent.click(select);
    await userEvent.click(screen.getByRole("option", { name: "50" }));

    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });

  it("draws nothing when there are no transactions", () => {
    renderPagination({ meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 }, shown: 0 });

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});
