import { createPortfolioService } from "@trading/application";
import type { Actor, Clock } from "@trading/application";
import { InMemoryPortfolioRepository } from "@trading/persistence-memory";
import { UserRole } from "@trading/domain";

export interface DemoUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: UserRole;
}

export interface DemoComposition {
  readonly user: DemoUser;
  readonly actor: Actor;
  readonly portfolioService: ReturnType<typeof createPortfolioService>;
}

export interface DemoCompositionOptions {
  readonly clock?: Clock;
}

const DEMO_USER: DemoUser = {
  id: "demo-user",
  email: "demo@example.com",
  displayName: "Demo Trader",
  role: UserRole.TRADER,
};

/**
 * Wires the same application services as the API over the in-memory repositories (ADR-012 point 1).
 * It is the only place of the demo that knows which implementations back the ports. The state is
 * built again on every call, so a reset is a new composition.
 */
export async function createDemoComposition(
  options: DemoCompositionOptions = {},
): Promise<DemoComposition> {
  const clock = options.clock ?? { now: () => new Date() };
  const portfolioRepository = new InMemoryPortfolioRepository({ now: () => clock.now() });

  await portfolioRepository.create({
    userId: DEMO_USER.id,
    name: "Long-term growth",
    baseCurrency: "USD",
  });

  return {
    user: DEMO_USER,
    actor: { userId: DEMO_USER.id, role: DEMO_USER.role },
    portfolioService: createPortfolioService({ portfolioRepository }),
  };
}
