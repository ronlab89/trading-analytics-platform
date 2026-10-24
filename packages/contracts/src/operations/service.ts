import type { ApiOperation } from "../api-operation.js";
import {
  livenessResponseSchema,
  readinessResponseSchema,
  serviceInfoResponseSchema,
} from "../health.response.js";
import { dataEnvelope } from "../response-common.schema.js";
import {
  simulationModeRequestSchema,
  simulationStatusResponseSchema,
} from "../simulation.schema.js";

const CONTROL_NOTE = "Needs the `simulation:control` permission, which only the ADMIN role holds.";

/** The market simulator controls (ADR-007 points 10 and 16, 07-api-spec.md §54). */
export const simulationOperations: readonly ApiOperation[] = [
  {
    operationId: "startSimulation",
    method: "post",
    path: "/api/v1/simulation/start",
    tag: "Simulation",
    summary: "Start the simulator",
    description: `Moves it from \`HALTED\` to \`RUNNING\`, in the mode it had when it paused. Repeating it on a running simulator answers 200 unchanged. ${CONTROL_NOTE}`,
    authenticated: true,
    success: {
      status: 200,
      description: "The state and mode of the simulator.",
      schema: dataEnvelope(simulationStatusResponseSchema),
    },
    errors: [401, 403, 429],
  },
  {
    operationId: "pauseSimulation",
    method: "post",
    path: "/api/v1/simulation/pause",
    tag: "Simulation",
    summary: "Pause the simulator",
    description: `Moves it from \`RUNNING\` to \`HALTED\`: nothing ticks and no candle closes. Repeating it on a halted simulator answers 200 unchanged. ${CONTROL_NOTE}`,
    authenticated: true,
    success: {
      status: 200,
      description: "The state and mode of the simulator.",
      schema: dataEnvelope(simulationStatusResponseSchema),
    },
    errors: [401, 403, 429],
  },
  {
    operationId: "setSimulationMode",
    method: "put",
    path: "/api/v1/simulation/mode",
    tag: "Simulation",
    summary: "Set the simulation mode",
    description: `The \`PAUSED\` mode keeps the loop running but emits nothing. A mode set while \`HALTED\` takes effect on start. ${CONTROL_NOTE}`,
    authenticated: true,
    body: simulationModeRequestSchema,
    success: {
      status: 200,
      description: "The state and mode of the simulator.",
      schema: dataEnvelope(simulationStatusResponseSchema),
    },
    errors: [400, 401, 403, 429],
  },
];

/** Service endpoints with no authentication and no `{ data }` envelope (07-api-spec.md §30). */
export const healthOperations: readonly ApiOperation[] = [
  {
    operationId: "getServiceInfo",
    method: "get",
    path: "/",
    tag: "Health",
    summary: "Check that the service answers",
    authenticated: false,
    success: {
      status: 200,
      description: "The service name and status.",
      schema: serviceInfoResponseSchema,
    },
    errors: [],
  },
  {
    operationId: "getLiveness",
    method: "get",
    path: "/health",
    tag: "Health",
    summary: "Liveness",
    description: "Is the process running? It checks no dependency.",
    authenticated: false,
    success: {
      status: 200,
      description: "The process is running.",
      schema: livenessResponseSchema,
    },
    errors: [],
  },
  {
    operationId: "getReadiness",
    method: "get",
    path: "/health/ready",
    tag: "Health",
    summary: "Readiness",
    description:
      "Can the service serve requests that need the database? While the process shuts down it answers 503 at once, with no checks.",
    authenticated: false,
    success: {
      status: 200,
      description: "The service and the database are ready.",
      schema: readinessResponseSchema,
    },
    otherResponses: [
      {
        status: 503,
        description: "The database is unavailable, or the process is shutting down.",
        schema: readinessResponseSchema,
      },
    ],
    errors: [],
  },
];
