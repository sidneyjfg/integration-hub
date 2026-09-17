import { sincronizarNotasMercadoLivre } from './services/sincronizar-notas-mercadolivre'
import { sincronizarSFTPMercadoLivre } from './services/sincronizar-sftp-mercadolivre'
import { sincronizarEtiquetaMercadoLivre } from './services/sincronizar-etiqueta-mercadolivre'
import { executarBuscaCS } from './services/busca-cs-google-sheets'
import { buscarValoresPedidosMercadoLivre } from './api/buscar-pedidos-mercadolivre'
import { notifyGoogleChat, notifyGoogleChatError } from './notifications/google-chat'
import { coreConfig } from '../../core/env.schema'

let notasMLRunning = false

function diaAnterior(data: string): string {
  const valor = new Date(Date.UTC(
    Number(data.slice(0, 4)),
    Number(data.slice(4, 6)) - 1,
    Number(data.slice(6, 8)) - 1,
  ))
  return `${valor.getUTCFullYear()}${String(valor.getUTCMonth() + 1).padStart(2, '0')}${String(valor.getUTCDate()).padStart(2, '0')}`
}

export async function executarCronNotas() {
  if (notasMLRunning) {
    console.warn('[MERCADOLIVRE][CRON] Execução anterior ainda em andamento; ciclo ignorado')
    return
  }

  notasMLRunning = true
  try {
    const sincronizacao = await sincronizarNotasMercadoLivre()
    if (!sincronizacao.completo) {
      console.warn('[BUSCA-CS] Monitoramento incompleto; publicação no Sheets ignorada')
      return
    }

    if (!coreConfig.ATIVA_BUSCA_CS) return

    try {
      let diasAlterados = [...sincronizacao.diasAlterados]
      if (sincronizacao.periodo) {
        const pedidos = await buscarValoresPedidosMercadoLivre(
          sincronizacao.periodo.inicio,
          sincronizacao.periodo.fim,
        )
        if (pedidos.erros > 0 || pedidos.naoEncontrados > 0) {
          throw new Error(
            `Busca de pedidos incompleta: ${pedidos.naoEncontrados} não encontrados e ${pedidos.erros} erros.`,
          )
        }
        diasAlterados = [...new Set([...diasAlterados, ...pedidos.diasAlterados])]
      }
      const d1 = sincronizacao.periodo ? diaAnterior(sincronizacao.periodo.fim) : null
      if (!d1 || !diasAlterados.includes(d1)) {
        console.log('[BUSCA-CS] Nenhuma alteração no D-1; planilha não será atualizada')
        return
      }
      const resultado = await executarBuscaCS(d1, [d1])
      await notifyGoogleChat(`[BUSCA-CS] Planilha preenchida com sucesso. Aba: ${resultado.aba}. Dia de apuração: ${resultado.dataApuracao}. Período: ${resultado.inicio} até ${resultado.fim}. Total de notas: ${resultado.totalNotas}. Valor bruto: ${resultado.valorBruto}.`)
    } catch (error: any) {
      await notifyGoogleChatError(`[BUSCA-CS] Erro ao preencher o Google Sheets. Os últimos dados corretos foram preservados. Detalhe: ${error?.message ?? 'erro desconhecido'}`)
    }
  } finally {
    notasMLRunning = false
  }
}

export async function executarCronSFTP(){
  await sincronizarSFTPMercadoLivre()
}

export async function executarCronEtiqueta() {
  await sincronizarEtiquetaMercadoLivre()
}
