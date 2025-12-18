import path from 'path'

import { buscarNotasMercadoLivre } from '../api/buscar-notas-mercadolivre'
import { filtrarPorIgnoreEndFile, getAllXmlFiles } from '../utils'
import { notifyGoogleChat } from '../notifications/google-chat'
import { buildMercadoLivreSftpNotification } from '../notifications/build-sftp-notification'
import { mercadolivreConfig } from '../env.schema'

import { resolverModoEnvio } from './resolve-modo-envio'
import { executarLocalSimples } from '../sftp/modos/local-simples'
import { executarLocalLedger } from '../sftp/modos/local-ledger'
import { executarSftpSimples } from '../sftp/modos/sftp-simples'
import { executarSftpLedger } from '../sftp/modos/sftp-ledger'
import { executarSftpVonder } from '../sftp/modos/sftp-vonder'
import { ResultadoEnvio } from '../../../shared/types'

export async function sincronizarSFTPMercadoLivre(): Promise<void> {
  console.log('[MERCADOLIVRE][SFTP] Iniciando sincronização SFTP')

  const modo = resolverModoEnvio()
  console.log('[MERCADOLIVRE][SFTP] Modo selecionado:', modo)

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
      '[MERCADOLIVRE][SFTP] CLIENTE_ID, ACCESS_TOKEN e REFRESH_TOKEN desalinhados'
    )
  }

  for (let i = 0; i < clienteIds.length; i++) {
    const clienteId = clienteIds[i]
    const accessToken = accessTokens[i]
    const refreshToken = refreshTokens[i]

    console.log('[MERCADOLIVRE][SFTP] Processando cliente', { clienteId })

    try {
      const { notas, startDate, endDate } =
        await buscarNotasMercadoLivre({
          clienteId,
          accessToken,
          refreshToken,
          endOverride: mercadolivreConfig.MERCADOLIVRE_END_SFTP
        })

      const ignoreTipos =
        mercadolivreConfig.MERCADOLIVRE_SFTP_IGNORE_TIPO_NOTA
          ?.split(',')
          .map(s => s.trim()) ?? []

      const notasFiltradas = notas.filter(
        n => !ignoreTipos.includes(n.tipoNota)
      )

      let files = notasFiltradas
        .map(n => n.filePath)
        .filter(Boolean) as string[]

      files = filtrarPorIgnoreEndFile(
        files,
        mercadolivreConfig.MERCADOLIVRE_SFTP_IGNORE_END_FILE
      )

      // 🔁 fallback legado (somente se não veio nada do extract)
      if (!files.length) {
        const extractRoot = path.resolve('./notas/xml')
        files = await getAllXmlFiles(extractRoot)
      }

      if (!files.length) {
        console.log('[MERCADOLIVRE][SFTP] Nenhum XML encontrado', { clienteId })
        continue
      }

      let enviados = 0
      let resultadoEnvio: ResultadoEnvio = { arquivos: [], total: 0 }

      switch (modo) {
        case 'LOCAL_SIMPLES':
          await executarLocalSimples(files)
          break

        case 'LOCAL_LEDGER':
          resultadoEnvio = await executarLocalLedger(files)
          break

        case 'SFTP_SIMPLES':
          await executarSftpSimples(files)
          break

        case 'SFTP_LEDGER':
          resultadoEnvio = await executarSftpLedger(files)
          break

        case 'SFTP_VONDER':
          resultadoEnvio = await executarSftpVonder(files)
          break
      }

      const usarEnviados = modo.includes('_LEDGER')

      const notasParaNotificar = usarEnviados
        ? notasFiltradas.filter(n =>
          resultadoEnvio.arquivos.includes(path.basename(n.filePath!))
        )
        : notasFiltradas

      // 📣 NOTIFICAÇÃO — SOMENTE O QUE FOI ENVIADO
      const notification = await buildMercadoLivreSftpNotification({
        clienteId,
        modo,
        notas: notasParaNotificar,
        startDate,
        endDate,
        targetDir: mercadolivreConfig.MERCADOLIVRE_SFTP_DIR
      })

      await notifyGoogleChat(notification)

    } catch (err) {
      console.error('[MERCADOLIVRE][SFTP] Erro ao processar cliente', {
        clienteId,
        err
      })

      await notifyGoogleChat(
        `❌ Erro no SFTP Mercado Livre • Cliente ${clienteId}`
      )

      continue
    }
  }

  console.log('[MERCADOLIVRE][SFTP] Sincronização SFTP finalizada')
}
