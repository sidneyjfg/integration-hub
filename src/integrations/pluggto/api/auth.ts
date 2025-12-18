import axios from 'axios'
import { pluggtoConfig } from '../env.schema'

type TokenCache = {
  token: string
  expiresAt: number // timestamp em ms
}

let tokenCache: TokenCache | null = null

/**
 * 🔐 Obtém token OAuth do Pluggto
 * Usa cache em memória e renova se expirado
 */
export async function getAccessToken(forceRefresh = false): Promise<string | null> {
  const now = Date.now()

  // 👉 Usa cache se existir e não estiver expirado
  if (
    !forceRefresh &&
    tokenCache &&
    tokenCache.expiresAt > now
  ) {
    return tokenCache.token
  }

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
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    })

    const { access_token, expires_in } = response.data ?? {}

    if (!access_token) {
      console.error('[PLUGGTO][AUTH] Token não retornado')
      return null
    }

    // ⏱ cache com margem de segurança (ex: -60s)
    tokenCache = {
      token: access_token,
      expiresAt: now + (expires_in - 60) * 1000,
    }

    return access_token

  } catch (error: any) {
    console.error('[PLUGGTO][AUTH] Erro ao obter token')

    if (error.response) {
      console.error('[PLUGGTO][AUTH] Status:', error.response.status)
      console.error('[PLUGGTO][AUTH] Body:', error.response.data)
    } else {
      console.error('[PLUGGTO][AUTH]', error.message)
    }

    tokenCache = null
    return null
  }
}
