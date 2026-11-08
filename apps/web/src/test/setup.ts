import * as jestDomMatchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll, expect, vi } from "vitest";
import * as axeMatchers from "vitest-axe/matchers";

// `@testing-library/jest-dom/vitest` extends the `expect` of the `vitest` copy it
// resolves from its own pnpm folder, not ours, so the matchers are registered here.
expect.extend(jestDomMatchers);
expect.extend(axeMatchers);

// axe-core probes canvas support; jsdom does not implement it and logs a warning.
beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  // Radix Select asks the pointer and the scroll position of elements jsdom leaves out.
  Object.assign(HTMLElement.prototype, {
    hasPointerCapture: vi.fn(() => false),
    releasePointerCapture: vi.fn(),
    setPointerCapture: vi.fn(),
    scrollIntoView: vi.fn(),
  });
  // Radix measures the hidden form input of a checkbox with ResizeObserver; jsdom has none.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
});

afterEach(() => {
  cleanup();
});
