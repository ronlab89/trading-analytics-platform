import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadTextFile } from "./download-text-file";

const originalUrl = URL;

afterEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal("URL", originalUrl);
});

describe("downloadTextFile", () => {
  it("clicks a link to a blob of the text, named as asked, then cleans up", async () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:csv");
    const revokeObjectURL = vi.fn<(url: string) => void>();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    downloadTextFile("template.csv", "a,b\n");

    expect(click).toHaveBeenCalledTimes(1);
    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toBe("template.csv");
    expect(link.href).toBe("blob:csv");
    const blob = createObjectURL.mock.calls[0]?.[0];
    expect(await blob?.text()).toBe("a,b\n");
    expect(blob?.type).toBe("text/csv;charset=utf-8");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:csv");
    expect(document.body.querySelector("a")).toBeNull();
  });
});
