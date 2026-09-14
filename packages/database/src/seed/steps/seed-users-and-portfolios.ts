import { validateNewUser, validateNewPortfolio } from "@trading/domain";
import { PrismaUserRepository } from "../../repositories/prisma-user-repository.js";
import { PrismaPortfolioRepository } from "../../repositories/prisma-portfolio-repository.js";
import { SEED_USER } from "../data/user.js";
import { SEED_PORTFOLIOS } from "../data/portfolios.js";
import type { SeedContext } from "../context.js";

const userRepository = new PrismaUserRepository();
const portfolioRepository = new PrismaPortfolioRepository();

/**
 * Seeds the single demo user and their portfolios.
 * Source: 12-demo-mode-spec.md §13 (Initial Dataset).
 */
export async function seedUsersAndPortfolios(context: SeedContext): Promise<SeedContext> {
  console.log("[seed] seeding user and portfolios...");

  validateNewUser(SEED_USER);
  const user = await userRepository.create(SEED_USER);

  const portfolioIds: string[] = [];

  for (const blueprint of SEED_PORTFOLIOS) {
    const input = {
      userId: user.id,
      name: blueprint.name,
      baseCurrency: blueprint.baseCurrency,
      ...(blueprint.description !== undefined ? { description: blueprint.description } : {}),
    };

    validateNewPortfolio(input);
    const portfolio = await portfolioRepository.create(input);
    portfolioIds.push(portfolio.id);
  }

  return {
    ...context,
    userId: user.id,
    portfolioIds,
  };
}
