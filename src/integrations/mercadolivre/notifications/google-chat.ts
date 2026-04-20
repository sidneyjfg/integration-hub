import axios from 'axios'
import { mercadolivreConfig } from '../env.schema'

type GoogleChatMessage =
  | string
  | {
      cards: unknown[]
    }
  | {
      cardsV2: unknown[]
    }
  | {
      header?: unknown
      sections?: unknown[]
    }

/**
 * 📣 Envia notificação para Google Chat
 * - string → mensagem simples
 * - objeto → card
 */
export async function notifyGoogleChat(
  message: GoogleChatMessage
): Promise<void> {
  const webhookUrl = mercadolivreConfig.GOOGLE_CHAT_WEBHOOK_URL

  if (!webhookUrl) {
    console.warn(
      '[MERCADOLIVRE][NOTIFY] GOOGLE_CHAT_WEBHOOK_URL não configurada'
    )
    return
  }

  const body =
    typeof message === 'string'
      ? { text: message }
      : 'cards' in message
        ? message
        : 'cardsV2' in message
          ? message
        : { cards: [message] }

  try {
    await axios.post(webhookUrl, body, {
      headers: {
        'Content-Type': 'application/json'
      }
    })

    console.log('[MERCADOLIVRE][NOTIFY] Notificação enviada')
  } catch (error: any) {
    console.error(
      '[MERCADOLIVRE][NOTIFY] Erro ao enviar notificação',
      {
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data
      }
    )
  }
}
