type CronTask = () => Promise<void> | void

let fila: Promise<void> = Promise.resolve()

/**
 * Serializa todas as execuções de cron deste processo.
 *
 * O encadeamento de rejeições é tratado separadamente para que uma falha
 * não impeça os próximos crons de serem executados.
 */
export function enfileirarCron(nome: string, task: CronTask): Promise<void> {
  const execucao = fila.then(async () => {
    console.log(`[CRON] Iniciando ${nome}`)

    try {
      await task()
    } finally {
      console.log(`[CRON] Finalizado ${nome}`)
    }
  })

  fila = execucao.catch(() => undefined)

  return execucao
}
