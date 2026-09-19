import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {
  createTransactionRequestSchema,
  listTransactionsQuerySchema,
} from "../schemas/transaction.schema.js";
import {
  createTransactionHandler,
  getTransactionByIdHandler,
  listTransactionsHandler,
} from "../controllers/transactions.controller.js";

export const transactionsRouter: ExpressRouter = Router();

transactionsRouter.get(
  "/api/v1/portfolios/:portfolioId/transactions",
  authenticate,
  validate(listTransactionsQuerySchema, "query"),
  listTransactionsHandler,
);

transactionsRouter.get(
  "/api/v1/portfolios/:portfolioId/transactions/:transactionId",
  authenticate,
  getTransactionByIdHandler,
);

transactionsRouter.post(
  "/api/v1/portfolios/:portfolioId/transactions",
  authenticate,
  validate(createTransactionRequestSchema, "body"),
  createTransactionHandler,
);
