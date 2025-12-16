import axios, { AxiosError } from 'axios'
import { notifyGoogleChat } from '../notifications/google-chat'

// import { sendNotificationEmail } from '../../notifications/email'

type RefreshAccessTokenParams = {
  clientId: string
  clientSecret: string
  refreshToken: string
  clienteId: string
}

type MercadoLivreOAuthResponse = {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
  user_id: number
}

export async function refreshAccessToken(
  params: RefreshAccessTokenParams
): Promise<string> {
  const {
    clientId,
    clientSecret,
    refreshToken,
    clienteId
  } = params

  try {
    const response = await axios.post<MercadoLivreOAuthResponse>(
      'https://api.mercadolibre.com/oauth/token',
      null,
      {
        params: {
          grant_type: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken
        }
      }
    )

    console.log('[MERCADOLIVRE][AUTH] Token atualizado com sucesso', {
      clienteId
    })

    return response.data.access_token
  } catch (err) {
    const error = err as AxiosError<any>

    if (error.response?.data?.error === 'invalid_grant') {
      console.error(
        '[MERCADOLIVRE][AUTH ERROR] Refresh token expirado ou inválido',
        { clienteId }
      )

      await notifyGoogleChat(
        `❌ Erro de autenticação no Mercado Livre.\n` +
        `Conta ${clienteId}: refresh token expirado ou já utilizado.\n` +
        `É necessário atualizar as credenciais da conta master.`
      )

      // 📧 email com passo a passo (como você descreveu)
    //   await sendNotificationEmail(clienteId)

    } else {
      console.error(
        '[MERCADOLIVRE][AUTH ERROR] Falha ao atualizar o token',
        {
          clienteId,
          message: error.message,
          status: error.response?.status
        }
      )
    }

    throw error
  }
}
