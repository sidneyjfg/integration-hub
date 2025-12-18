import {
  salvarNotasTmpMercadoLivre,
  // buscarNotasNaoIntegradasNerus,
  buscarNotasNaoIntegradasNerusPorChaves,
  verificarECriarTabelaTmpNotas
} from '../repositories/mercadolivre-notas.repository'
import { notifyGoogleChat } from '../notifications/google-chat'
import { buscarNotasMercadoLivre } from '../api/buscar-notas-mercadolivre'
import { mercadolivreConfig } from '../env.schema'
import { buildNotaNaoIntegradaCard } from '../notifications/build-notas-notification'

export async function sincronizarNotasMercadoLivre(): Promise<void> {
  console.log('[MERCADOLIVRE][SYNC] Iniciando sincronização de notas')

  try {
    console.log('[MERCADOLIVRE][SYNC] Verificando tabela tmp_notas')
    await verificarECriarTabelaTmpNotas()
    console.log('[MERCADOLIVRE][SYNC] Tabela tmp_notas OK')

    const clienteIds =
      mercadolivreConfig.MERCADOLIVRE_CLIENTE_ID.split(',').map(s => s.trim())

    const accessTokens =
      mercadolivreConfig.MERCADOLIVRE_ACCESS_TOKEN.split(',').map(s => s.trim())

    const refreshTokens =
      mercadolivreConfig.MERCADOLIVRE_REFRESH_TOKEN.split(',').map(s => s.trim())

    if (
      clienteIds.length !== accessTokens.length ||
      clienteIds.length !== refreshTokens.length
    ) {
      throw new Error(
        '[MERCADOLIVRE][CONFIG] CLIENTE_ID, ACCESS_TOKEN e REFRESH_TOKEN com tamanhos diferentes'
      )
    }

    for (let i = 0; i < clienteIds.length; i++) {
      const clienteId = clienteIds[i]
      const accessToken = accessTokens[i]
      const refreshToken = refreshTokens[i]

      console.log('\n==============================')
      console.log('[MERCADOLIVRE][SYNC] Iniciando cliente', { clienteId })
      console.log('==============================')

      try {
        const { notas } =
          await buscarNotasMercadoLivre({
            clienteId,
            accessToken,
            refreshToken
          })
        const chavesCliente = notas.map(n => n.chave)

        console.log('[MERCADOLIVRE][SYNC][BUSCA FINALIZADA]', {
          clienteId,
          totalNotas: notas.length
        })

        if (notas.length === 0) {
          console.log('[MERCADOLIVRE][SYNC] Nenhuma nota encontrada', { clienteId })
          await notifyGoogleChat(
            `⚠️ Nenhuma nota fulfillment encontrada para a conta ${clienteId}.`
          )
          continue
        }

        console.log('[MERCADOLIVRE][SYNC][DB] Iniciando inserção', {
          clienteId,
          totalNotas: notas.length,
          chavesExemplo: notas.slice(0, 5).map(n => n.chave)
        })

        const insertedCount =
          await salvarNotasTmpMercadoLivre(notas)

        console.log('[MERCADOLIVRE][SYNC][DB] Inserção finalizada', {
          clienteId,
          insertedCount
        })

        console.log('[MERCADOLIVRE][SYNC][DB] Buscando notas não integradas')
        const notasNaoIntegradas =
          await buscarNotasNaoIntegradasNerusPorChaves(chavesCliente)


        console.log('[MERCADOLIVRE][SYNC][DB] Resultado comparação', {
          clienteId,
          totalNaoIntegradas: notasNaoIntegradas.length
        })

        if (notasNaoIntegradas.length > 0) {

          // 🔔 resumo
          await notifyGoogleChat(
            `⚠️ ${notasNaoIntegradas.length} notas do Mercado Livre não integradas no Nérus (Conta ${clienteId}).`
          )

          // 📋 cards por nota
          const cards = notasNaoIntegradas.map(nota =>
            buildNotaNaoIntegradaCard(nota, clienteId)
          )

          await notifyGoogleChat({ cards })
        }
        else {
          await notifyGoogleChat(
            `✅ Todas as notas do Mercado Livre foram integradas no Nérus (Conta ${clienteId}).`
          )
        }

        console.log('[MERCADOLIVRE][SYNC] Cliente finalizado com sucesso', {
          clienteId
        })

      } catch (erroCliente) {
        console.error('[MERCADOLIVRE][SYNC][CLIENTE ERRO]', {
          clienteId,
          erro: erroCliente
        })

        await notifyGoogleChat(
          `❌ Erro ao processar notas do Mercado Livre para a conta ${clienteId}.`
        )
      }
    }

    console.log('[MERCADOLIVRE][SYNC] Sincronização geral finalizada')

  } catch (erro) {
    console.error('[MERCADOLIVRE][SYNC] ERRO GERAL', erro)

    await notifyGoogleChat(
      'Erro geral ao executar sincronização de notas do Mercado Livre.'
    )

    throw erro
  }
}
