import { AssetType } from "./enums";
import type { AssetStatus } from "./enums";

/**
 * Asset entity.
 * Source: docs/05-data-model.md §7
 *
 * Represents a tradable instrument. Has no dependency on any other
 * domain entity (Portfolio, Position, Transaction reference Asset,
 * not the other way around).
 */
export interface Asset {
  readonly id: string;
  readonly symbol: string;
  readonly name: string;
  readonly assetType: AssetType;
  readonly currency: string;
  readonly exchange: string;
  readonly status: AssetStatus;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export type CreateAssetInput = Omit<Asset, "id" | "status" | "metadata"> & {
  status?: AssetStatus;
  metadata?: Readonly<Record<string, unknown>>;
};

export class InvalidAssetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAssetError";
  }
}

/**
 * Domain invariants for Asset creation.
 */
export function validateNewAsset(input: CreateAssetInput): void {
  if (!input.symbol || input.symbol.trim().length === 0) {
    throw new InvalidAssetError("Symbol is required.");
  }

  if (!input.name || input.name.trim().length === 0) {
    throw new InvalidAssetError("Name is required.");
  }

  if (!input.currency || input.currency.trim().length === 0) {
    throw new InvalidAssetError("Currency is required.");
  }

  if (!Object.values(AssetType).includes(input.assetType)) {
    throw new InvalidAssetError(`Unsupported asset type: ${input.assetType}`);
  }
}
