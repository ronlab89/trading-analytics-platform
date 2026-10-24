import { z } from "zod";

/**
 * The optional header of the creating endpoints that makes a request safe to
 * repeat (ADR-008 point 8): printable ASCII with no space, 1 to 255 characters.
 */
export const idempotencyKeyHeaderSchema = z.object({
  "Idempotency-Key": z
    .string()
    .regex(/^[\x21-\x7E]{1,255}$/)
    .optional(),
});
