import axios from 'axios'
import { coreConfig } from '../../../core/env.schema'

export async function notifyGoogleChat(message: string): Promise<void> {
  if (!coreConfig.GOOGLE_CHAT_WEBHOOK_URL) {
    console.warn('[GOOGLE_CHAT] Webhook não configurado. Mensagem ignorada.')
    return
  }

  const payload = {
    cardsV2: [
      {
        cardId: 'notificacao',
        card: {
          header: {
            title: '📦 Integrações Hub',
            subtitle: 'Anymarket'
          },
          sections: [
            {
              widgets: [
                {
                  textParagraph: {
                    text: message.replace(/\n/g, '<br>')
                  }
                }
              ]
            }
          ]
        }
      }
    ]
  }

  try {
    await axios.post(coreConfig.GOOGLE_CHAT_WEBHOOK_URL, payload, {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error(
      '[GOOGLE_CHAT] Erro ao enviar mensagem',
      error.response?.data || error.message
    )
  }
}
