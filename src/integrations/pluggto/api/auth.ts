import axios from 'axios'
import { pluggtoConfig } from '../env.schema'

/**
 * 🔐 Obtém token OAuth do PluggTo
 * Grant type: password
 */
export async function getAccessToken(): Promise<string | null> {
  const {
    PLUGGTO_URL,
    PLUGGTO_CLIENT_ID,
    PLUGGTO_CLIENT_SECRET,
    PLUGGTO_USERNAME,
    PLUGGTO_PASSWORD,
  } = pluggtoConfig

  const url = `${PLUGGTO_URL}/oauth/token`

  const payload = new URLSearchParams({
    grant_type: 'password',
    client_id: PLUGGTO_CLIENT_ID,
    client_secret: PLUGGTO_CLIENT_SECRET,
    username: PLUGGTO_USERNAME,
    password: PLUGGTO_PASSWORD,
  })

  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 15000,
    })

    const token = response.data?.access_token

    if (!token) {
      console.error('[PLUGGTO][AUTH] Token não retornado pela API')
      return null
    }

    return token

  } catch (error: any) {
    console.error('[PLUGGTO][AUTH] Erro ao obter token')

    if (error.response) {
      console.error('[PLUGGTO][AUTH] Status:', error.response.status)
      console.error('[PLUGGTO][AUTH] Body:', error.response.data)
    } else {
      console.error('[PLUGGTO][AUTH]', error.message)
    }

    return null
  }
}
