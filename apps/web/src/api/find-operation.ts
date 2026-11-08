import type { ApiOperation } from "@trading/contracts";

/** The operation with that id; an unknown id is a programming error, so it throws. */
export function findOperation(operations: readonly ApiOperation[], operationId: string) {
  const found = operations.find((candidate) => candidate.operationId === operationId);
  if (!found) {
    throw new Error(`Unknown operation "${operationId}"`);
  }
  return found;
}
