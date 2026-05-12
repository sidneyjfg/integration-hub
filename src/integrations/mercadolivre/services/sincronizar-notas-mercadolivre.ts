import {
  salvarNotasTmpMercadoLivre,
  // buscarNotasNaoIntegradasNerus,
  buscarNotasNaoIntegradasNerusPorChaves,
  verificarECriarTabelaTmpNotas,
  buscarCredenciaisMercadoLivre,
  getRetryCountFfpreprocnf,
  zerarRetryCountFfpreprocnf
} from '../repositories/mercadolivre-notas.repository'
import { notifyGoogleChat } from '../notifications/google-chat'
import { buscarNotasMercadoLivre } from '../api/buscar-notas-mercadolivre'
import { mercadolivreConfig } from '../env.schema'
import { buildNotasNaoIntegradasCard } from '../notifications/build-notas-notification'

async function processarRetryNotasNaoIntegradas(
  notasNaoIntegradas: Array<{ CHAVE_NFE?: string }>
): Promise<void> {
  const maxRetryCount = mercadolivreConfig.MERCADOLIVRE_MAX_RETRY_COUNT

  if (maxRetryCount == null) return

  let avaliadas = 0
  let zeradas = 0
  let ignoradas = 0
  let semRetryCount = 0

  for (const nota of notasNaoIntegradas) {
    const nfeKey = nota.CHAVE_NFE

    if (!nfeKey) {
      ignoradas++
      continue
    }

    const retryCount = await getRetryCountFfpreprocnf({ nfeKey })
    avaliadas++

    if (retryCount == null) {
      semRetryCount++
      continue
    }

    if (retryCount < maxRetryCount) {
      const affectedRows = await zerarRetryCountFfpreprocnf({ nfeKey })
      if (affectedRows > 0) zeradas++
      continue
    }

    ignoradas++
  }

  console.log('[MERCADOLIVRE][SYNC][RETRY] Processamento finalizado', {
    maxRetryCount,
    avaliadas,
    zeradas,
    ignoradas,
    semRetryCount
  })
}

export async function sincronizarNotasMercadoLivre(): Promise<void> {
  console.log('[MERCADOLIVRE][SYNC] Iniciando sincronização de notas')

  try {
    console.log('[MERCADOLIVRE][SYNC] Verificando tabela tmp_notas')
    await verificarECriarTabelaTmpNotas()
    console.log('[MERCADOLIVRE][SYNC] Tabela tmp_notas OK')

    const contas = await buscarCredenciaisMercadoLivre()

    if (!contas.length) {
      throw new Error('[MERCADOLIVRE] Nenhuma credencial válida encontrada no banco')
    }


    for (const conta of contas) {
      const clienteId = conta.clienteId
      const accessToken = conta.accessToken
      const refreshToken = conta.refreshToken
      const clientId = conta.clientId
      const clientSecret = conta.clientSecret

      console.log('\n==============================')
      console.log('[MERCADOLIVRE][SYNC] Iniciando cliente', { clienteId })
      console.log('==============================')

      try {
        const { notas } = await buscarNotasMercadoLivre({
          clienteId,
          clientId,
          clientSecret,
          accessToken,
          refreshToken,
          sftpMode: false
        })
        const chavesCliente = notas.map(n => n.chave)

        console.log('[MERCADOLIVRE][SYNC][BUSCA FINALIZADA]', {
          clienteId,
          totalNotas: notas.length
        })

        if (notas.length === 0) {
          console.log('[MERCADOLIVRE][SYNC] Nenhuma nota encontrada', { clienteId })
          await notifyGoogleChat(
            `⚠️ Nenhuma nota fulfillment encontrada para a cliente: ${mercadolivreConfig.CLIENT_NAME} - ${clienteId}.`
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
          await processarRetryNotasNaoIntegradas(notasNaoIntegradas)

          // 🔔 resumo
          await notifyGoogleChat(
            `⚠️ ${notasNaoIntegradas.length} notas do Mercado Livre não integradas no Nérus (Cliente: ${mercadolivreConfig.CLIENT_NAME} - Conta ${clienteId}).`
          )

          // 📋 cards por nota
          const card = buildNotasNaoIntegradasCard(
            notasNaoIntegradas,
            clienteId
          )

          await notifyGoogleChat(card)
        }
        else {
          await notifyGoogleChat(
            `✅ Todas as notas do Mercado Livre foram integradas no Nérus (Cliente: ${mercadolivreConfig.CLIENT_NAME} - Conta ${clienteId}).`
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
          `❌ Erro ao processar notas do Mercado Livre para o cliente: ${mercadolivreConfig.CLIENT_NAME} - Conta ${clienteId}.`
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
