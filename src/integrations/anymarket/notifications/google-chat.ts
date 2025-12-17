import axios from 'axios'
import { coreConfig } from '../../../core/env.schema'

const GOOGLE_CHAT_MAX_CHARS = 3500

function buildPayload(text: string) {
  return {
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
                    text: text.replace(/\n/g, '<br>')
                  }
                }
              ]
            }
          ]
        }
      }
    ]
  }
}

function buildResumoMensagem(
  original: string,
  total: number
): string {
  return `
⚠️ *Muitos pedidos não integrados*

A lista completa excedeu o limite de mensagem do Google Chat.

📊 *Resumo da divergência*:
• Total de pedidos não integrados: *${total}*

ℹ️ Consulte os logs ou a tabela *temp_orders* para detalhes completos.
`.trim()
}

export async function notifyGoogleChat(
  message: string,
  totalDivergencias?: number
): Promise<void> {
  if (!coreConfig.GOOGLE_CHAT_WEBHOOK_URL) {
    console.warn('[GOOGLE_CHAT] Webhook não configurado. Mensagem ignorada.')
    return
  }

  const isTooLarge = message.length > GOOGLE_CHAT_MAX_CHARS

  const finalMessage = isTooLarge
    ? buildResumoMensagem(message, totalDivergencias ?? 0)
    : message

  const payload = buildPayload(finalMessage)

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
