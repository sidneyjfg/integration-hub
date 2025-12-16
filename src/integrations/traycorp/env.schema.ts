// src/integrations/traycorp/env.schema.ts
import { z } from "zod";

export const traycorpEnvSchema = z.object({
  TRAY_URL: z.string().url(),
  TRAY_TOKEN: z.string().min(10),
});

export type TraycorpEnv = z.infer<typeof traycorpEnvSchema>;

export const trayConfig = traycorpEnvSchema.parse(process.env)
