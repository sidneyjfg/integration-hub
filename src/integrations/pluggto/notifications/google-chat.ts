import axios from 'axios';
import { coreConfig } from '../../../core/env.schema';

// Função para enviar a notificação via Google Chat Webhook
export async function notifyGoogleChat(message: string | object): Promise<void> {
  try {
    const webhookUrl = coreConfig.GOOGLE_CHAT_WEBHOOK_URL;

    if (!webhookUrl) {
      console.error('Erro: Variável de ambiente GOOGLE_CHAT_WEBHOOK_URL não definida.');
      return;
    }

    // Configurar o corpo da requisição para Google Chat
    const body = typeof message === 'string' 
      ? { text: message }
      : { cards: [message] };  // Se message for um objeto, envia como card

    // Fazer a requisição POST para o Google Chat Webhook
    const response = await axios.post(
      webhookUrl,
      body,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Notificação enviada com sucesso:', response.data);
  } catch (error: any) {
    console.error('Erro ao enviar notificação:', error.message);

    if (error.response) {
      console.error('Resposta da API:', error.response.data);
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
    } else if (error.request) {
      console.error('Nenhuma resposta recebida:', error.request);
    } else {
      console.error('Erro durante a configuração da requisição:', error.message);
    }
  }
}

export function formatarLinhaPedido(p: {
  ordnoweb: string
  status: string
  date: string
  channel?: string | null
}) {
  return (
    `• Pedido: ${p.ordnoweb}\n` +
    `  Status: ${p.status}\n` +
    `  Data: ${p.date}\n` +
    `  Canal: ${p.channel ?? '—'}`
  )
}
