import path from 'path'
import { mercadolivreConfig } from '../../env.schema'
import SftpClient from 'ssh2-sftp-client'
import { ledgerSimples } from '../ledger-simples'
import { ResultadoEnvio } from '../../../../shared/types'

type Agrupamento = Record<string, string[]>

function agruparPorDiretorio(files: string[]): Agrupamento {
  return files.reduce<Agrupamento>((acc, file) => {
    const dir = resolverDiretorioVonder(file)
    acc[dir] ??= []
    acc[dir].push(file)
    return acc
  }, {})
}


function resolverDiretorioVonder(file: string): string {
  const nome = path.basename(file).toLowerCase()

  if (
    nome.includes('evento') ||
    nome.includes('procevento') ||
    nome.includes('inutnfe')
  ) {
    return 'IN_EVENTOS'
  }

  if (
    nome.includes('cte') ||
    nome.includes('ct-e') ||
    nome.includes('proccte')
  ) {
    return 'CTE'
  }

  return 'IN'
}


async function enviarArquivoVonderComClient(
  sftp: SftpClient,
  file: string,
  targetRoot: string
): Promise<string | null> {

  const nome = path.basename(file)

  if (ledgerSimples.jaEnviado(nome)) {
    return null
  }

  const dir = resolverDiretorioVonder(file)
  const destino = path.posix.join(targetRoot, dir, nome)

  console.log('[VONDER][SFTP] Enviando', destino)
  await sftp.fastPut(file, destino)

  ledgerSimples.registrar([nome])
  return nome
}


export async function executarSftpVonder(
  files: string[]
): Promise<ResultadoEnvio> {
  const totalRecebidos = files.length

  // remove os já enviados (ledger)
  const pendentes = files.filter(
    f => !ledgerSimples.jaEnviado(path.basename(f))
  )

  console.log(
    `[VONDER][SFTP] Arquivos recebidos: ${totalRecebidos} | Pendentes: ${pendentes.length}`
  )

  if (!pendentes.length) {
    console.log('[VONDER][SFTP] Nenhum arquivo novo para envio')
    return { arquivos: [], total: 0 }
  }

  // agrupa por diretório
  const agrupados = agruparPorDiretorio(pendentes)

  console.log('[VONDER][SFTP] Distribuição por diretório:')
  for (const [dir, list] of Object.entries(agrupados)) {
    console.log(`  - ${dir}: ${list.length}`)
  }

  const sftp = new SftpClient()
  const enviados: string[] = []

  try {
    console.log('[VONDER][SFTP] Conectando ao servidor...')
    await sftp.connect({
      host: mercadolivreConfig.MERCADOLIVRE_SFTP_HOST,
      port: Number(mercadolivreConfig.MERCADOLIVRE_SFTP_PORT || 22),
      username: mercadolivreConfig.MERCADOLIVRE_SFTP_USER,
      password: mercadolivreConfig.MERCADOLIVRE_SFTP_PASSWORD,
      readyTimeout: 120000,
      keepaliveInterval: 10000
    })

    console.log('[VONDER][SFTP] Conectado com sucesso')

    let contador = 0
    const totalEnvio = pendentes.length

    for (const file of pendentes) {
      contador++

      const nome = path.basename(file)
      const dir = resolverDiretorioVonder(file)

      try {
        console.log(
          `[VONDER][SFTP] (${contador}/${totalEnvio}) Enviando ${nome} → ${dir}`
        )

        const enviado = await enviarArquivoVonderComClient(
          sftp,
          file,
          mercadolivreConfig.MERCADOLIVRE_SFTP_DIR!
        )

        if (enviado) {
          enviados.push(enviado)
          await new Promise(r => setTimeout(r, 300))
        }
      } catch (err) {
        console.error(
          `[VONDER][SFTP] (${contador}/${totalEnvio}) Erro no arquivo ${nome}`,
          err
        )
      }
    }
  } finally {
    await sftp.end().catch(() => {})
    console.log('[VONDER][SFTP] Conexão encerrada')
  }

  console.log(
    `[VONDER][SFTP] Envio finalizado: ${enviados.length}/${pendentes.length} arquivos enviados`
  )

  return {
    arquivos: enviados,
    total: enviados.length
  }
}

