import { z } from 'zod'

const toBool = (v: unknown) => {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v === 1
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    return s === '1' || s === 'true' || s === 'yes' || s === 'y'
  }
  return false
}

export const anymarketEnvSchema = z.object({
  ANYMARKET_URL: z.string().url().transform(url => url.replace(/\/+$/, '')),
  ANYMARKET_GUMGATOKEN: z.string(),
  ANYMARKET_DAYS_TO_FETCH: z.coerce.number().min(1),

  FULFILLMENT: z.preprocess(toBool, z.boolean()).default(false),
  CONVENCIONAL: z.preprocess(toBool, z.boolean()).default(false),

  NO_LOOK_STATUS_TYPE: z.string().default(''),

  // Nérus (opcionais)
  NERUS_NOTIFICATION_URL: z.string().url().optional().or(z.literal('')),
  NERUS_RECEIVE_NOTIFICATION_URL: z.string().url().optional().or(z.literal('')),
  NERUS_OI: z.string().optional(),
  SELLER: z.string().default('Default Seller')
})

export type AnymarketConfig = z.infer<typeof anymarketEnvSchema>

export const anymarketConfig = anymarketEnvSchema.parse(process.env)
