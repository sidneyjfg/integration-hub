import { z } from "zod";

export const wakeEnvSchema = z.object({
    WAKE_URL: z.string().url(),
    WAKE_TOKEN: z.string(),
});

export type WakeEnv = z.infer<typeof wakeEnvSchema>
export const wakeConfig = wakeEnvSchema.parse(process.env)
