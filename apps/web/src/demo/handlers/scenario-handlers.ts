import {
  presentScenario,
  presentScenarioCalculation,
  presentScenarioComparison,
} from "@trading/contracts";
import type {
  CompareScenariosRequestBody,
  CreateScenarioRequestBody,
  ListScenariosQuery,
  UpdateScenarioRequestBody,
} from "@trading/contracts";
import type { HandlerContext, HandlerRegistry } from "./handler";

interface ScenarioParams {
  readonly portfolioId: string;
  readonly scenarioId: string;
}

/** Mirrors `scenarios.controller.ts` of the API, on the same `ScenarioService`. */
export function createScenarioHandlers({ composition }: HandlerContext): HandlerRegistry {
  const { scenarioService, actor } = composition;

  return {
    listScenarios: async ({ params, query }) => {
      const { portfolioId } = params as { portfolioId: string };
      const { status } = query as ListScenariosQuery;
      const scenarios = await scenarioService.listScenarios(actor, portfolioId, {
        ...(status !== undefined ? { status } : {}),
      });
      return { data: scenarios.map(presentScenario) };
    },
    getScenario: async ({ params }) => {
      const { portfolioId, scenarioId } = params as ScenarioParams;
      return {
        data: presentScenario(
          await scenarioService.getScenarioById(actor, portfolioId, scenarioId),
        ),
      };
    },
    createScenario: async ({ params, body }) => {
      const { portfolioId } = params as { portfolioId: string };
      const { name, description, changes } = body as CreateScenarioRequestBody;
      const scenario = await scenarioService.createScenario(actor, portfolioId, {
        name,
        ...(description !== undefined ? { description } : {}),
        ...(changes !== undefined ? { changes } : {}),
      });
      return { data: presentScenario(scenario) };
    },
    updateScenario: async ({ params, body }) => {
      const { portfolioId, scenarioId } = params as ScenarioParams;
      const { name, description, status, changes } = body as UpdateScenarioRequestBody;
      const scenario = await scenarioService.updateScenario(actor, portfolioId, scenarioId, {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(changes !== undefined ? { changes } : {}),
      });
      return { data: presentScenario(scenario) };
    },
    deleteScenario: async ({ params }) => {
      const { portfolioId, scenarioId } = params as ScenarioParams;
      await scenarioService.deleteScenario(actor, portfolioId, scenarioId);
      return undefined;
    },
    archiveScenario: async ({ params }) => {
      const { portfolioId, scenarioId } = params as ScenarioParams;
      const { scenario, alreadyArchived } = await scenarioService.archiveScenario(
        actor,
        portfolioId,
        scenarioId,
      );
      return { data: presentScenario(scenario), meta: { alreadyArchived } };
    },
    calculateScenario: async ({ params }) => {
      const { portfolioId, scenarioId } = params as ScenarioParams;
      const result = await scenarioService.calculateScenario(actor, portfolioId, scenarioId);
      return { data: presentScenarioCalculation(result) };
    },
    compareScenarios: async ({ params, body }) => {
      const { portfolioId } = params as { portfolioId: string };
      const { scenarioIds } = body as CompareScenariosRequestBody;
      const comparison = await scenarioService.compareScenarios(actor, portfolioId, scenarioIds);
      return { data: presentScenarioComparison(comparison) };
    },
  };
}
