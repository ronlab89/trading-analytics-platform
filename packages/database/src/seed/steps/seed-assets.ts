import { validateNewAsset } from "@trading/domain";
import { PrismaAssetRepository } from "../../repositories/prisma-asset-repository.js";
import { SEED_ASSETS } from "../data/assets.js";
import type { SeedContext } from "../context.js";

const assetRepository = new PrismaAssetRepository();

/**
 * Seeds the asset catalog.
 * Source: 01-product-spec.md §9 (Assets), 05-data-model.md §7.
 */
export async function seedAssets(context: SeedContext): Promise<SeedContext> {
  console.log("[seed] seeding assets...");

  const assetIds: string[] = [];

  for (const input of SEED_ASSETS) {
    validateNewAsset(input);
    const asset = await assetRepository.create(input);
    assetIds.push(asset.id);
  }

  return {
    ...context,
    assetIds,
  };
}
