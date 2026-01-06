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

function classificarArquivoVonder(file: string): 'IN' | 'CTE' | 'IN_EVENTOS' {
  const nome = file.toLowerCase()

  if (nome.includes('evento') || nome.includes('proceventonfe')) {
    return 'IN_EVENTOS'
  }

  if (
    nome.includes('ct_e') ||
    nome.includes('ct-e') ||
    nome.includes('cte') ||
    nome.includes('proccte')
  ) {
    return 'CTE'
  }

  return 'IN'
}

export async function sincronizarSFTPMercadoLivre(): Promise<void> {
  console.log('[MERCADOLIVRE][SFTP] Iniciando sincronização SFTP')

  const modo = resolverModoEnvio()
  console.log('[MERCADOLIVRE][SFTP] Modo selecionado:', modo)

  const isVonder = modo === 'SFTP_VONDER_LEDGER'
  const isSftpMode = modo.startsWith('SFTP')

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

      // 📄 NF-e vindas do extract
      let files = notasFiltradas
        .map(n => n.filePath)
        .filter(Boolean) as string[]

      // 📦 VONDER → inclui TODOS os XML (CTE + EVENTOS)
      if (isSftpMode) {
        const extractRoot = path.resolve('./notas/xml')
        const allXmlFiles = await getAllXmlFiles(extractRoot)

        const extras = allXmlFiles.filter(f => !files.includes(f))
        files.push(...extras)
      }

      files = filtrarPorIgnoreEndFile(
        files,
        mercadolivreConfig.MERCADOLIVRE_SFTP_IGNORE_END_FILE
      )

      if (!files.length) {
        console.log('[MERCADOLIVRE][SFTP] Nenhum XML encontrado', { clienteId })
        continue
      }

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

        case 'SFTP_VONDER_LEDGER':
          resultadoEnvio = await executarSftpVonder(files)
          break
      }

      // 🔎 RESUMO REAL POR TIPO (somente VONDER)
      let resumoPorTipo: Record<string, number> | undefined

      if (isVonder) {
        resumoPorTipo = resultadoEnvio.arquivos.reduce<Record<string, number>>(
          (acc, nome) => {
            const tipo = classificarArquivoVonder(nome)
            acc[tipo] = (acc[tipo] || 0) + 1
            return acc
          },
          {}
        )
      }

      const notification = await buildMercadoLivreSftpNotification({
        clienteId,
        modo,
        notas: isVonder ? [] : notasFiltradas,
        totalEncontradas: isVonder ? files.length : notasFiltradas.length,
        totalEnviadas: resultadoEnvio.arquivos.length,
        startDate,
        endDate,
        targetDir: mercadolivreConfig.MERCADOLIVRE_SFTP_DIR,
        resumoPorTipo
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
    }
  }

  console.log('[MERCADOLIVRE][SFTP] Sincronização SFTP finalizada')
}
