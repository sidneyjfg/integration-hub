import { buscarProdutosAnymarket } from '../api/anymarket-produtos.api'
import { salvarProdutos } from '../repositories/anymarket-produtos.repository'
import { notifyGoogleChat } from '../notifications/google-chat'
import type { AnymarketProduct } from '../../../shared/types/anymarket'

export async function sincronizarProdutosAnymarket(): Promise<void> {
  const startTime = Date.now()
  console.log('[Anymarket Produtos] Iniciando sincronização de produtos...')

  try {
    let offset = 0
    const limit = 100
    let totalProdutos = 0
    let totalSkus = 0
    let hasMore = true

    while (hasMore) {
      console.log(`[Anymarket Produtos] Buscando produtos - offset: ${offset}, limit: ${limit}`)

      const response = await buscarProdutosAnymarket({ limit, offset })

      if (response.content && response.content.length > 0) {
        const produtos = response.content
        totalProdutos += produtos.length

        // Contar total de SKUs
        const skusNesteBatch = produtos.reduce((acc, p) => acc + (p.skus?.length || 0), 0)
        totalSkus += skusNesteBatch

        // Salvar produtos no banco
        const rowsAffected = await salvarProdutos(produtos)
        console.log(
          `[Anymarket Produtos] Salvos ${produtos.length} produtos com ${skusNesteBatch} SKUs (${rowsAffected} registros afetados)`
        )

        // Verificar se há mais produtos para buscar
        offset += limit
        hasMore = offset < response.totalElements
      } else {
        hasMore = false
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    const mensagem = `✅ Sincronização de produtos Anymarket concluída!\n\n📦 Total de produtos: ${totalProdutos}\n📋 Total de SKUs: ${totalSkus}\n⏱️ Tempo: ${duration}s`

    console.log(`[Anymarket Produtos] ${mensagem}`)

    await notifyGoogleChat(mensagem)
  } catch (erro) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    const mensagemErro = `❌ Erro na sincronização de produtos Anymarket!\n\n⏱️ Tempo: ${duration}s\n🔴 Erro: ${erro instanceof Error ? erro.message : 'Erro desconhecido'}`
    
    console.error('[Anymarket Produtos] Erro na sincronização:', erro)

    await notifyGoogleChat(mensagemErro)

    throw erro
  }
}
