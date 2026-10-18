import { z } from "zod";
import { UserRole } from "@trading/domain";
import { isoTimestampSchema } from "./response-common.schema.js";

const userRoleValues = Object.values(UserRole) as [UserRole, ...UserRole[]];

/**
 * Response shape for POST /api/v1/auth/login.
 * Source: 07-api-spec.md §9, ADR-005 points 4 and 8.
 *
 * The refresh token is not part of the body: it travels only in an
 * `HttpOnly` cookie, so scripts never see it.
 */
export const loginResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
    displayName: z.string(),
    role: z.enum(userRoleValues),
  }),
  session: z.object({
    accessToken: z.string(),
    expiresAt: isoTimestampSchema,
  }),
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export interface LoginPresenterInput {
  user: { id: string; email: string; displayName: string; role: UserRole };
  accessToken: string;
  expiresAt: Date;
}

export function presentLogin(result: LoginPresenterInput): LoginResponse {
  return {
    user: {
      id: result.user.id,
      email: result.user.email,
      displayName: result.user.displayName,
      role: result.user.role,
    },
    session: {
      accessToken: result.accessToken,
      expiresAt: result.expiresAt.toISOString(),
    },
  };
}
