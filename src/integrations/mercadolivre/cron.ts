import { sincronizarNotasMercadoLivre } from './services/sincronizar-notas-mercadolivre'
import { sincronizarSFTPMercadoLivre } from './services/sincronizar-sftp-mercadolivre'
import { sincronizarEtiquetaMercadoLivre } from './services/sincronizar-etiqueta-mercadolivre'
import { executarBuscaCS } from './services/busca-cs-google-sheets'
import { notifyGoogleChat, notifyGoogleChatError } from './notifications/google-chat'
import { coreConfig } from '../../core/env.schema'

let notasMLRunning = false

export async function executarCronNotas() {
  if (notasMLRunning) {
    console.warn('[MERCADOLIVRE][CRON] Execução anterior ainda em andamento; ciclo ignorado')
    return
  }

  notasMLRunning = true
  try {
    const completo = await sincronizarNotasMercadoLivre()
    if (!completo) {
      console.warn('[BUSCA-CS] Monitoramento incompleto; publicação no Sheets ignorada')
      return
    }

    if (!coreConfig.ATIVA_BUSCA_CS) return

    try {
      const resultado = await executarBuscaCS()
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
