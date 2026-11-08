import { createContext, use, type ReactNode } from "react";
import type { DemoControls } from "./app-runtime";

const DemoControlsContext = createContext<DemoControls | undefined>(undefined);

interface DemoControlsProviderProps {
  controls: DemoControls | undefined;
  children: ReactNode;
}

/** Hands the demo controls, when the runtime has them, to the shell. */
export function DemoControlsProvider({ controls, children }: DemoControlsProviderProps) {
  return <DemoControlsContext value={controls}>{children}</DemoControlsContext>;
}

/** The controls of the demo menu, or `undefined` outside the demo build: then there is no menu. */
export function useDemoControls(): DemoControls | undefined {
  return use(DemoControlsContext);
}
