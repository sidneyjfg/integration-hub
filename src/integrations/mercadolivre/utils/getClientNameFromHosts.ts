import { mercadolivreConfig } from "../env.schema"

/**
 * Retorna o nome do cliente baseado na variável de ambiente CLIENT_NAME
 */
export function getClientNameFromHosts(): string | null {
  try {
    const clientName = mercadolivreConfig.CLIENT_NAME

    if (!clientName || clientName.trim() === '') {
      console.warn('[ENV] CLIENT_NAME não definido no ambiente.')
      return null
    }

    return clientName.trim()
  } catch (err: any) {
    console.error('[ENV] Erro ao acessar CLIENT_NAME', {
      message: err?.message
    })
    return null
  }
}
