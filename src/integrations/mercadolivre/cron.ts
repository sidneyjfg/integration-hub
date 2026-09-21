import { sincronizarNotasMercadoLivre } from './services/sincronizar-notas-mercadolivre'
import { sincronizarSFTPMercadoLivre } from './services/sincronizar-sftp-mercadolivre'
import { sincronizarEtiquetaMercadoLivre } from './services/sincronizar-etiqueta-mercadolivre'

let notasMLRunning = false

export async function executarCronNotas() {
  if (notasMLRunning) {
    console.warn('[MERCADOLIVRE][CRON] Execução anterior ainda em andamento; ciclo ignorado')
    return
  }

  notasMLRunning = true
  try {
    await sincronizarNotasMercadoLivre()
  } finally {
    notasMLRunning = false
  }
}

let buscaCSRunning = false

export async function executarCronBuscaCS() {
  if (buscaCSRunning) {
    console.warn('[BUSCA-CS][CRON] Execução anterior ainda em andamento; ciclo ignorado')
    return
  }

  buscaCSRunning = true
  try {
    const { executarBuscaCS, resolverD1Atual } = await import('./services/busca-cs-google-sheets.js')
    const { notifyGoogleChat, notifyGoogleChatError } = await import('./notifications/google-chat.js')

    try {
      const d1 = resolverD1Atual()
      const resultado = await executarBuscaCS(d1, [d1])
      await notifyGoogleChat(`[BUSCA-CS] Planilha atualizada. Aba: ${resultado.aba}. Dia de apuração: ${resultado.dataApuracao}. Período: ${resultado.inicio} até ${resultado.fim}. Total de notas: ${resultado.totalNotas}. Valor bruto: ${resultado.valorBruto}.`)
    } catch (error: any) {
      await notifyGoogleChatError(`[BUSCA-CS] Erro ao atualizar o Google Sheets. Os últimos dados corretos foram preservados. Detalhe: ${error?.message ?? 'erro desconhecido'}`)
    }
  } finally {
    buscaCSRunning = false
  }
}

export async function executarCronSFTP() {
  await sincronizarSFTPMercadoLivre()
}

export async function executarCronEtiqueta() {
  await sincronizarEtiquetaMercadoLivre()
}
