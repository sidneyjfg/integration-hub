// src/integrations/traycommerce/services/sincronizar-produtos-traycommerce.ts
import { buscarProdutosTraycommerce } from '../api/traycommerce-client'
import { salvarEstoqueTraycommerce } from '../repositories/produtos.repository'
import {
  notifyGoogleChat,
  notifyGoogleChatWarning
} from '../notifications/google-chat'

export async function sincronizarProdutosTraycommerce(): Promise<void> {
  console.log('[TRAYCOMMERCE][PRODUTOS] Iniciando sincronização de estoque')

  const produtos = await buscarProdutosTraycommerce()

  if (!produtos.length) {
    console.warn('[TRAYCOMMERCE][PRODUTOS] Nenhum produto encontrado')
    await notifyGoogleChatWarning(
      'Nenhum produto encontrado na TrayCommerce para monitorar estoque.'
    )
    return
  }

  const linhasAfetadas = await salvarEstoqueTraycommerce(produtos)

  const variantes = produtos.filter(p => p.is_variant).length
  const base = produtos.length - variantes

  console.log('[TRAYCOMMERCE][PRODUTOS] Estoque sincronizado', {
    produtos: base,
    variantes,
    linhasAfetadas
  })

  await notifyGoogleChat(
    `📦 Estoque sincronizado na TrayCommerce.\n` +
      `Produtos: ${base}\n` +
      `Variantes: ${variantes}\n` +
      `Linhas afetadas: ${linhasAfetadas}`
  )
}
