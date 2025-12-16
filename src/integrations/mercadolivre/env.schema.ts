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

export const mercadolivreEnvSchema = z.object({
    // 🔐 Credenciais Mercado Livre
    MERCADOLIVRE_CLIENT_ID: z.string().min(1),
    MERCADOLIVRE_CLIENT_SECRET: z.string().min(1),
    MERCADOLIVRE_ACCESS_TOKEN: z.string().min(1),
    MERCADOLIVRE_REFRESH_TOKEN: z.string().min(1),

    // 🧾 Conta Mercado Livre
    MERCADOLIVRE_CLIENTE_ID: z.string().min(1),

    // 🏬 Lojas Nérus associadas (CSV)
    MERCADOLIVRE_STORENOS: z.string().min(1),

    // ⏱️ Período de busca
    MERCADOLIVRE_DAYS_TO_FETCH: z.coerce.number().min(1),
    MERCADOLIVRE_END_TO_FETCH: z.coerce.number().min(0).default(0),
    // ⚠️ Comportamentos opcionais
    MERCADOLIVRE_DISPONIBILIZA_XML_DIVERGENTE: z.preprocess(toBool, z.boolean()).default(false),

    MERCADOLIVRE_MAX_RETRY_COUNT: z.coerce.number().min(0).optional(),

    MERCADOLIVRE_SFTP_ENABLED: z.preprocess(toBool, z.boolean()).default(false),
    MERCADOLIVRE_SFTP_DIR: z.string().default(''),
    MERCADOLIVRE_USE_LEDGER: z.preprocess(toBool, z.boolean()).default(false),
    // 📁 Filtros SFTP
    MERCADOLIVRE_SFTP_IGNORE_END_FILE: z.string().optional().default(''),
    MERCADOLIVRE_SFTP_IGNORE_TIPO_NOTA: z.string().optional().default(''),
    MERCADOLIVRE_IGNORE_SERIE: z.string().optional().default(''),
    MERCADOLIVRE_IS_VONDER: z.preprocess(toBool, z.boolean()).default(false),
    MERCADOLIVRE_SFTP_UID: z.coerce.number().optional(),
    MERCADOLIVRE_SFTP_GID: z.coerce.number().optional(),
    // 📣 Notificação
    GOOGLE_CHAT_WEBHOOK_URL:
        z.string().url().optional().or(z.literal(''))
})

export type MercadoLivreConfig =
    z.infer<typeof mercadolivreEnvSchema>

export const mercadolivreConfig =
    mercadolivreEnvSchema.parse(process.env)
