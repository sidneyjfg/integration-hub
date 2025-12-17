import { z } from 'zod'

export const pluggtoEnvSchema = z.object({
    PLUGGTO_URL: z.string().url(),
    PLUGGTO_CLIENT_ID: z.string(),
    PLUGGTO_CLIENT_SECRET: z.string(),
    PLUGGTO_USERNAME: z.string(),
    PLUGGTO_PASSWORD: z.string(),
    PLUGGTO_DAYS_TO_FETCH: z.string(),
    STORENO: z.string(),
    // 🔔 endpoint do Nérus para reenvio
    NERUS_RECEIVE_ORDER_URL: z.string().url(),
})

export type PluggtoEnv = z.infer<typeof pluggtoEnvSchema>
export const pluggtoConfig = pluggtoEnvSchema.parse(process.env)
