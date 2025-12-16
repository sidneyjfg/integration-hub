import path from 'path'

import { buscarNotasMercadoLivre } from '../api/buscar-notas-mercadolivre'
import { filtrarPorIgnoreEndFile, filtrarPorTipoNota, getAllXmlFiles } from '../utils'
import { notifyGoogleChat } from '../notifications/google-chat'

import { mercadolivreConfig } from '../env.schema'


import { resolverModoEnvio } from './resolve-modo-envio'
import { executarLocalSimples } from '../sftp/modos/local-simples'
import { executarLocalLedger } from '../sftp/modos/local-ledger'
import { executarSftpSimples } from '../sftp/modos/sftp-simples'
import { executarSftpLedger } from '../sftp/modos/sftp-ledger'
import { executarSftpVonder } from '../sftp/modos/sftp-vonder'

export async function sincronizarSFTPMercadoLivre(): Promise<void> {
  console.log('[MERCADOLIVRE][SFTP] Iniciando sincronização')

  const modo = resolverModoEnvio()
  console.log('[MERCADOLIVRE][SFTP] Modo selecionado:', modo)

  const notas = await buscarNotasMercadoLivre()

  let files = notas.map(n => n.filePath).filter(Boolean)

  // 🔁 fallback legado
  if (!files.length) {
    const extractRoot = path.resolve('./notas/xml')
    files = await getAllXmlFiles(extractRoot)
  }

  if (!files.length) {
    console.log('[MERCADOLIVRE][SFTP] Nenhum XML encontrado')
    return
  }

  // =====================================================
  // 🔥 FILTROS GLOBAIS (APLICA A TODOS OS MODOS)
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
    console.log('[MERCADOLIVRE][SFTP] Nenhum XML após filtros')
    return
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
    `📤 Mercado Livre • ${files.length} XML(s) processados • modo ${modo}`
  )
}
