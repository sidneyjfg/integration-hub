import { z } from "zod";

export const traycommerceEnvSchema = z.object({
    TRAYCOMMERCE_URL: z.string().url(),
    TRAYCOMMERCE_CONSUMER_KEY: z.string(),
    TRAYCOMMERCE_SECRET_KEY: z.string(),
    TRAYCOMMERCE_CODE: z.string(),
    TRAYCOMMERCE_STORE_ID: z.string(),
    TRAYCOMMERCE_ORDER_STATUS_TO_GET: z.string(),
});

export type TraycommerceEnv = z.infer<typeof traycommerceEnvSchema>
export const traycommerceConfig = traycommerceEnvSchema.parse(process.env)
