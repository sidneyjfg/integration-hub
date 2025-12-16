// services/sincronizar-produtos-pluggto.ts
import { buscarProdutosPluggto } from '../api/buscar-produtos-pluggto'
import { salvarProdutosTempPluggto } from '../repositories/produtos.repository'

export async function sincronizarProdutosPluggto() {
  console.log('[PLUGGTO][SYNC] Iniciando produtos')

  const produtos = await buscarProdutosPluggto()
  if (!produtos.length) return

  await salvarProdutosTempPluggto(produtos)

  console.log('[PLUGGTO][SYNC] Produtos sincronizados:', produtos.length)
}
