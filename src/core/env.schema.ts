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

export const coreEnvSchema = z.object({
  PORT: z.coerce.number().default(3000),

  DB_HOST_MONITORAMENTO: z.string(),
  DB_PORT_MONITORAMENTO: z.coerce.number().default(3306),
  DB_USER_MONITORAMENTO: z.string(),
  DB_PASS_MONITORAMENTO: z.string(),

  DB_NAME_DADOS: z.string(),
  DB_NAME_MONITORAMENTO: z.string(),

  ACTIVE_INTEGRATIONS: z.string(),
  STORENOS: z.string().default('1'),
  CRON_PEDIDOS: z.string().optional(),
  CRON_PRODUTOS: z.string().optional(),
  CRON_NOTAS_ML: z.string().optional(),
  CRON_NOTAS_SFTP: z.string().optional(),
  GOOGLE_CHAT_WEBHOOK_URL: z.string().url(),
  TZ: z.string().optional(),
  USA_ETIQUETA: z.preprocess(toBool, z.boolean()).default(false)
})

export type CoreEnv = z.infer<typeof coreEnvSchema>

export function validateCoreEnv(): CoreEnv {
  return coreEnvSchema.parse(process.env)
}
export const coreConfig: CoreEnv = coreEnvSchema.parse(process.env)
