import { z } from "zod";

export const loginRequestSchema = z.object({
  email: z.email({ message: "A valid email is required." }),
  password: z.string().min(1, { message: "A password is required." }),
});

export type LoginRequestBody = z.infer<typeof loginRequestSchema>;
