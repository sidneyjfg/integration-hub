import { sincronizarNotasMercadoLivre } from './services/sincronizar-notas-mercadolivre'
import { sincronizarSFTPMercadoLivre } from './services/sincronizar-sftp-mercadolivre'
import { sincronizarEtiquetaMercadoLivre } from './services/sincronizar-etiqueta-mercadolivre'
import { apurarBuscaCSDiaria } from './services/busca-cs-diaria'

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
let buscaCSRetryTimer: NodeJS.Timeout | undefined

function formatarDiaBuscaCS(dia: string): string {
  return `${dia.slice(6, 8)}/${dia.slice(4, 6)}`
}

function formatarIntervalosBuscaCS(blocos: Array<{ inicio: string; fim: string }>): string {
  return blocos.length
    ? blocos.map(bloco => `${formatarDiaBuscaCS(bloco.inicio)} ao ${formatarDiaBuscaCS(bloco.fim)}`).join(', ')
    : 'nenhum bloco concluído'
}

export async function executarCronBuscaCS() {
  if (buscaCSRunning) {
    console.warn('[BUSCA-CS][CRON] Execução anterior ainda em andamento; ciclo ignorado')
    return
  }

  buscaCSRunning = true
  const blocosConcluidos: Array<{ inicio: string; fim: string }> = []
  let blocoEmAndamento: { inicio: string; fim: string; retomarDia: string } | undefined
  try {
    const { executarBuscaCS, resolverD1Atual } = await import('./services/busca-cs-google-sheets.js')
    const { notifyGoogleChat, notifyGoogleChatError } = await import('./notifications/google-chat.js')

    try {
      const d1 = resolverD1Atual()
      const progresso = await apurarBuscaCSDiaria(
        d1,
        false,
        async bloco => {
          await executarBuscaCS(d1, bloco.dias, bloco.valoresPorDia, bloco.notasPorDia)
          blocosConcluidos.push({ inicio: bloco.inicio, fim: bloco.fim })
        },
        bloco => {
          blocoEmAndamento = bloco
          return Promise.resolve()
        },
      )
      if (buscaCSRetryTimer) clearTimeout(buscaCSRetryTimer)
      buscaCSRetryTimer = undefined
      const resumo = Object.values(progresso.valoresPorDia ?? {}).slice(-1)[0] ?? 0
      const notas = Object.values(progresso.notasPorDia ?? {}).reduce((total, quantidade) => total + quantidade, 0)
      await notifyGoogleChat(`[BUSCA-CS] Execução concluída. Blocos atualizados: ${formatarIntervalosBuscaCS(blocosConcluidos)}. Até ${formatarDiaBuscaCS(d1)}: ${notas} notas; valor bruto acumulado ${resumo}.`)
    } catch (error: any) {
      const blocoErro = blocoEmAndamento
        ? `${formatarDiaBuscaCS(blocoEmAndamento.inicio)} ao ${formatarDiaBuscaCS(blocoEmAndamento.fim)}`
        : 'não identificado'
      const retomar = blocoEmAndamento
        ? `${formatarDiaBuscaCS(blocoEmAndamento.retomarDia)} ao ${formatarDiaBuscaCS(blocoEmAndamento.fim)}`
        : 'início do período'
      const detalhe = String(error?.message ?? 'erro desconhecido').slice(0, 500)
      console.error('[BUSCA-CS][CRON] Apuração parcial; haverá nova tentativa', {
        blocosConcluidos,
        blocoErro,
        retomar,
        erro: detalhe,
      })
      await notifyGoogleChatError(`[BUSCA-CS] Execução parcial. Blocos concluídos: ${formatarIntervalosBuscaCS(blocosConcluidos)}. Bloco ${blocoErro} falhou: ${detalhe}. Na próxima execução retomará de ${retomar}. Nova tentativa automática em 30 minutos.`)
      if (buscaCSRetryTimer) clearTimeout(buscaCSRetryTimer)
      buscaCSRetryTimer = setTimeout(() => {
        buscaCSRetryTimer = undefined
        void executarCronBuscaCS()
      }, 30 * 60 * 1000)
      buscaCSRetryTimer.unref?.()
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
