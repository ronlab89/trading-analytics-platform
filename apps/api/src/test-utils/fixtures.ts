import bcrypt from "bcryptjs";
import { prisma, PrismaUserRepository, PrismaCredentialRepository } from "@trading/database";
import type { Portfolio, User } from "@trading/domain";
import { PrismaPortfolioRepository } from "@trading/database";

const userRepository = new PrismaUserRepository();
const credentialRepository = new PrismaCredentialRepository();
const portfolioRepository = new PrismaPortfolioRepository();

const TEST_PASSWORD = "correct-horse-battery-staple";

export interface TestUser {
  user: User;
  password: string;
}

/**
 * Creates a user with a real, login-able credential directly through
 * the repositories — there is no registration endpoint yet (deferred
 * to Phase 4, RBAC), so integration tests seed identity this way
 * instead of going through HTTP.
 *
 * Each call uses a random email so tests can run concurrently without
 * unique-constraint collisions, matching the pattern already used by
 * the repository test suites (e.g. prisma-asset-repository.test.ts).
 */
export async function createTestUser(): Promise<TestUser> {
  const user = await userRepository.create({
    email: `test-${crypto.randomUUID()}@example.com`,
    displayName: "Integration Test User",
  });

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  await credentialRepository.create({ userId: user.id, passwordHash });

  return { user, password: TEST_PASSWORD };
}

/** Creates a portfolio owned by the given user, with sensible defaults. */
export async function createTestPortfolio(
  userId: string,
  overrides: { name?: string; baseCurrency?: string } = {},
): Promise<Portfolio> {
  return portfolioRepository.create({
    userId,
    name: overrides.name ?? "Integration Test Portfolio",
    baseCurrency: overrides.baseCurrency ?? "USD",
  });
}

export interface TestAssetHandle {
  id: string;
}

/** Creates a disposable asset with a unique symbol, for transaction tests. */
export async function createTestAsset(symbolPrefix = "TST"): Promise<TestAssetHandle> {
  const asset = await prisma.asset.create({
    data: {
      symbol: `${symbolPrefix}-${crypto.randomUUID().slice(0, 8)}`,
      name: "Integration Test Asset",
      assetType: "STOCK",
      currency: "USD",
      exchange: "MOCK",
    },
  });
  return { id: asset.id };
}

/**
 * Deletes everything created by the helpers above, for the given user
 * and asset ids. Cascades through portfolios/transactions/positions via
 * Prisma's referential actions where configured; where it is not,
 * deletes explicitly in dependency order (children before parents).
 */
export async function cleanupTestData(params: {
  userIds?: string[];
  assetIds?: string[];
}): Promise<void> {
  const { userIds = [], assetIds = [] } = params;

  if (userIds.length > 0) {
    const portfolios = await prisma.portfolio.findMany({
      where: { userId: { in: userIds } },
      select: { id: true },
    });
    const portfolioIds = portfolios.map((p) => p.id);

    if (portfolioIds.length > 0) {
      await prisma.transaction.deleteMany({ where: { portfolioId: { in: portfolioIds } } });
      await prisma.position.deleteMany({ where: { portfolioId: { in: portfolioIds } } });
      await prisma.portfolio.deleteMany({ where: { id: { in: portfolioIds } } });
    }

    await prisma.credential.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  if (assetIds.length > 0) {
    await prisma.asset.deleteMany({ where: { id: { in: assetIds } } });
  }
}
