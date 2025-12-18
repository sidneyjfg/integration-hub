import path from 'path'
import { mercadolivreConfig } from '../../env.schema'
import { sendFilesViaSFTP } from '../../utils'
import {
  filtrarPorIgnoreEndFile,
  filtrarPorTipoNota
} from '../../utils'
import { ledgerSimples } from '../ledger-simples'
import { ResultadoEnvio } from '../../../../shared/types'

export async function executarSftpVonder(
  files: string[]
): Promise<ResultadoEnvio> {

  const {
    MERCADOLIVRE_SFTP_DIR,
    MERCADOLIVRE_SFTP_IGNORE_END_FILE,
    MERCADOLIVRE_SFTP_IGNORE_TIPO_NOTA
  } = mercadolivreConfig

  // 1️⃣ Filtros globais
  let filtrados = filtrarPorIgnoreEndFile(
    files,
    MERCADOLIVRE_SFTP_IGNORE_END_FILE
  )

  filtrados = await filtrarPorTipoNota(
    filtrados,
    MERCADOLIVRE_SFTP_IGNORE_TIPO_NOTA
  )

  // 2️⃣ Ledger (antes)
  const novos = filtrados.filter(
    f => !ledgerSimples.jaEnviado(path.basename(f))
  )

  if (!novos.length) {
    console.log('[VONDER][SFTP] Nenhum arquivo novo após ledger')
    return { arquivos: [], total: 0 }
  }

  // 3️⃣ Classificação
  const isEventoNFe = (file: string) => {
    const n = file.toLowerCase()
    if (n.includes('cte') || n.includes('ct-e')) return false
    if (n.includes('procevento')) return true
    if (n.includes('evento') && !n.includes('procnfe')) return true
    if (n.includes('inutnfe')) return true
    return false
  }

  const isCTe = (file: string) => {
    const n = file.toLowerCase()
    return n.includes('cte') || n.includes('ct-e') || n.includes('proccte')
  }

  const join = (dir: string) =>
    path.posix.join(MERCADOLIVRE_SFTP_DIR!, dir)

  // 4️⃣ Envio sequencial + commit por arquivo
  const enviados: string[] = []

  for (const file of novos) {
    const nome = path.basename(file)

    let dir = 'IN'
    if (isEventoNFe(file)) dir = 'IN_EVENTOS'
    else if (isCTe(file)) dir = 'CTE'

    await sendFilesViaSFTP(file, join(dir))
    ledgerSimples.registrar([nome])
    enviados.push(nome)
    ledgerSimples.registrar([nome])
    enviados.push(nome)

    await new Promise(r => setTimeout(r, 500)) // proteção SFTP frágil
  }

  console.log('[VONDER][SFTP] Envio concluído', {
    total: enviados.length
  })

  return {
    arquivos: enviados,
    total: enviados.length
  }
}
