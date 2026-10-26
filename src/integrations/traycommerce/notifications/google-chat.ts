// src/integrations/traycommerce/notifications/google-chat.ts
import axios from "axios";
import { coreConfig } from "../../../core/env.schema";

/**
 * Card no mesmo formato dos outros hubs do repo (cardsV2 com um
 * textParagraph). O `\n` precisa virar `<br>`, senão o Google Chat
 * renderiza tudo em uma linha só.
 */
function enviarCard(
  webhookUrl: string | undefined,
  titulo: string,
  mensagem: string
): Promise<void> {
  if (!webhookUrl) {
    console.warn("[GOOGLE_CHAT] Webhook não configurado. Mensagem ignorada.");
    return Promise.resolve();
  }

  const payload = {
    cardsV2: [
      {
        cardId: "traycommerce-notificacao",
        card: {
          header: {
            title: titulo,
            subtitle: "Nerus Integrações",
          },
          sections: [
            {
              widgets: [
                {
                  textParagraph: {
                    text: mensagem.replace(/\n/g, "<br>"),
                  },
                },
              ],
            },
          ],
        },
      },
    ],
  };

  return axios
    .post(webhookUrl, payload, {
      headers: { "Content-Type": "application/json" },
    })
    .then(() => {
      console.log("[GOOGLE_CHAT] Notificação enviada com sucesso");
    })
    .catch((error: any) => {
      console.error(
        "[GOOGLE_CHAT] Erro ao enviar mensagem",
        error.response?.data || error.message
      );
    });
}

// Função para enviar a notificação via Google Chat Webhook
export async function notifyGoogleChat(message: string): Promise<void> {
  await enviarCard(
    coreConfig.GOOGLE_CHAT_WEBHOOK_URL,
    "✅ OK - TrayCommerce",
    message
  );
}

export async function notifyGoogleChatWarning(message: string): Promise<void> {
  await enviarCard(
    coreConfig.GOOGLE_CHAT_WEBHOOK_URL_WARNING,
    "⚠️ Alerta - TrayCommerce",
    message
  );
}

export async function notifyGoogleChatError(message: string): Promise<void> {
  await enviarCard(
    coreConfig.GOOGLE_CHAT_WEBHOOK_URL_ERROR,
    "🚨 Erro - TrayCommerce",
    message
  );
}
