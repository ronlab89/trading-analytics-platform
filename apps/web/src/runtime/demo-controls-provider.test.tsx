import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { DemoControls } from "./app-runtime";
import { DemoControlsProvider, useDemoControls } from "./demo-controls-provider";

const controls: DemoControls = {
  simulateConnectionIssue: vi.fn(),
  sendTestNotification: vi.fn(),
  reset: vi.fn(),
};

describe("useDemoControls", () => {
  it("is undefined without a provider, so a build without demo has no controls", () => {
    const { result } = renderHook(() => useDemoControls());

    expect(result.current).toBeUndefined();
  });

  it("is undefined when the runtime has no demo controls", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <DemoControlsProvider controls={undefined}>{children}</DemoControlsProvider>
    );

    const { result } = renderHook(() => useDemoControls(), { wrapper });

    expect(result.current).toBeUndefined();
  });

  it("gives the controls of the runtime", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <DemoControlsProvider controls={controls}>{children}</DemoControlsProvider>
    );

    const { result } = renderHook(() => useDemoControls(), { wrapper });

    expect(result.current).toBe(controls);
  });
});
