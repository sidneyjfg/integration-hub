import path from 'path'

import { buscarNotasMercadoLivre } from '../api/buscar-notas-mercadolivre'
import {
  filtrarPorIgnoreEndFile,
  filtrarPorTipoNota,
  getAllXmlFiles
} from '../utils'
import { notifyGoogleChat } from '../notifications/google-chat'
import { mercadolivreConfig } from '../env.schema'

import { resolverModoEnvio } from './resolve-modo-envio'
import { executarLocalSimples } from '../sftp/modos/local-simples'
import { executarLocalLedger } from '../sftp/modos/local-ledger'
import { executarSftpSimples } from '../sftp/modos/sftp-simples'
import { executarSftpLedger } from '../sftp/modos/sftp-ledger'
import { executarSftpVonder } from '../sftp/modos/sftp-vonder'

export async function sincronizarSFTPMercadoLivre(): Promise<void> {
  console.log('[MERCADOLIVRE][SFTP] Iniciando sincronização SFTP')

  const modo = resolverModoEnvio()
  console.log('[MERCADOLIVRE][SFTP] Modo selecionado:', modo)

  // =====================================================
  // 🔑 MULTI-CLIENTE
  // =====================================================
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

  // =====================================================
  // 🔁 LOOP POR CLIENTE
  // =====================================================
  for (let i = 0; i < clienteIds.length; i++) {
    const clienteId = clienteIds[i]
    const accessToken = accessTokens[i]
    const refreshToken = refreshTokens[i]

    console.log('[MERCADOLIVRE][SFTP] Processando cliente', { clienteId })

    try {
      const notas = await buscarNotasMercadoLivre({
        clienteId,
        accessToken,
        refreshToken,
        // 🔥 override exclusivo para SFTP
        endOverride: mercadolivreConfig.MERCADOLIVRE_END_SFTP
      })

      let files = notas.map(n => n.filePath).filter(Boolean)

      // 🔁 fallback legado
      if (!files.length) {
        const extractRoot = path.resolve('./notas/xml')
        files = await getAllXmlFiles(extractRoot)
      }

      if (!files.length) {
        console.log('[MERCADOLIVRE][SFTP] Nenhum XML encontrado', { clienteId })
        continue
      }

      // =====================================================
      // 🔥 FILTROS GLOBAIS
      // =====================================================
      files = filtrarPorIgnoreEndFile(
        files,
        mercadolivreConfig.MERCADOLIVRE_SFTP_IGNORE_END_FILE
      )

      files = await filtrarPorTipoNota(
        files,
        mercadolivreConfig.MERCADOLIVRE_SFTP_IGNORE_TIPO_NOTA
      )

      if (!files.length) {
        console.log('[MERCADOLIVRE][SFTP] Nenhum XML após filtros', {
          clienteId
        })
        continue
      }

      // =====================================================
      // 🚚 EXECUÇÃO POR MODO
      // =====================================================
      switch (modo) {
        case 'LOCAL_SIMPLES':
          await executarLocalSimples(files)
          break

        case 'LOCAL_LEDGER':
          await executarLocalLedger(files)
          break

        case 'SFTP_SIMPLES':
          await executarSftpSimples(files)
          break

        case 'SFTP_LEDGER':
          await executarSftpLedger(files)
          break

        case 'SFTP_VONDER':
          await executarSftpVonder(files)
          break
      }

      await notifyGoogleChat(
        `📤 Mercado Livre • Cliente ${clienteId} • ${files.length} XML(s) • modo ${modo}`
      )

    } catch (err) {
      console.error('[MERCADOLIVRE][SFTP] Erro ao processar cliente', {
        clienteId,
        err
      })

      await notifyGoogleChat(
        `❌ Erro no SFTP Mercado Livre • Cliente ${clienteId}`
      )

      // ⚠️ não interrompe os outros clientes
      continue
    }
  }

  console.log('[MERCADOLIVRE][SFTP] Sincronização SFTP finalizada')
}
