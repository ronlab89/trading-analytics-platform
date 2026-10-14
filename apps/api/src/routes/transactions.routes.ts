import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {
  createTransactionRequestSchema,
  listTransactionsQuerySchema,
  portfolioIdParamsSchema,
  portfolioTransactionParamsSchema,
} from "@trading/contracts";
import { makeTransactionsController } from "../controllers/transactions.controller.js";
import { composition } from "../composition.js";

const { createTransactionHandler, getTransactionByIdHandler, listTransactionsHandler } =
  makeTransactionsController(composition.transactionService);

export const transactionsRouter: ExpressRouter = Router();

transactionsRouter.get(
  "/api/v1/portfolios/:portfolioId/transactions",
  authenticate,
  validate(portfolioIdParamsSchema, "params"),
  validate(listTransactionsQuerySchema, "query"),
  listTransactionsHandler,
);

transactionsRouter.get(
  "/api/v1/portfolios/:portfolioId/transactions/:transactionId",
  authenticate,
  validate(portfolioTransactionParamsSchema, "params"),
  getTransactionByIdHandler,
);

transactionsRouter.post(
  "/api/v1/portfolios/:portfolioId/transactions",
  authenticate,
  validate(portfolioIdParamsSchema, "params"),
  validate(createTransactionRequestSchema, "body"),
  createTransactionHandler,
);
