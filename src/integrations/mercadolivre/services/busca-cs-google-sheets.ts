import { google, sheets_v4 } from 'googleapis'
import { coreConfig } from '../../../core/env.schema'
import { buscarResumoDiarioBuscaCS } from '../repositories/busca-cs.repository'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const HEADER_NOTAS = 'dia de apuração'
const HEADER_FATURAMENTO = 'vendas'

export type BuscaCSResult = {
  aba: string
  dataApuracao: string
  inicio: string
  fim: string
  totalNotas: number
  valorBruto: number
}

function agoraEmSaoPaulo() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date())
  const get = (tipo: string) => partes.find(p => p.type === tipo)?.value ?? ''
  return { ano: Number(get('year')), mes: Number(get('month')), dia: Number(get('day')) }
}

function a1Coluna(numero: number): string {
  let valor = numero + 1
  let resultado = ''
  while (valor > 0) {
    const resto = (valor - 1) % 26
    resultado = String.fromCharCode(65 + resto) + resultado
    valor = Math.floor((valor - 1) / 26)
  }
  return resultado
}

function normalizar(texto: unknown): string {
  return String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

function nomeAba(ano: number, mes: number, tipo: 'Notas' | 'Faturamento') {
  return `${tipo} ${MESES[mes - 1]}`
}

function dataAnterior(ano: number, mes: number, dia: number): string {
  const data = new Date(Date.UTC(ano, mes - 1, dia - 1))
  return `${data.getUTCFullYear()}${String(data.getUTCMonth() + 1).padStart(2, '0')}${String(data.getUTCDate()).padStart(2, '0')}`
}

export function resolverPeriodoD1(d1: string) {
  if (!/^\d{8}$/.test(d1)) throw new Error('D-1 deve estar no formato YYYYMMDD')
  const data = new Date(Date.UTC(Number(d1.slice(0, 4)), Number(d1.slice(4, 6)) - 1, Number(d1.slice(6, 8))))
  if (data.getUTCFullYear() !== Number(d1.slice(0, 4)) || data.getUTCMonth() + 1 !== Number(d1.slice(4, 6)) || data.getUTCDate() !== Number(d1.slice(6, 8))) throw new Error('D-1 inválido')
  const amanha = new Date(data)
  amanha.setUTCDate(amanha.getUTCDate() + 1)
  const ano = data.getUTCFullYear()
  const mes = data.getUTCMonth() + 1
  return {
    ano, mes, diaApuracao: amanha.getUTCDate(), d1,
    inicio: `${ano}${String(mes).padStart(2, '0')}01`,
    fim: `${amanha.getUTCFullYear()}${String(amanha.getUTCMonth() + 1).padStart(2, '0')}${String(amanha.getUTCDate()).padStart(2, '0')}`,
    diasNoMes: new Date(ano, mes, 0).getDate(),
  }
}

function intervaloAba(aba: string, intervalo: string) {
  return `'${aba.replace(/'/g, "''")}'!${intervalo}`
}

const CABECALHOS_PROPRIOS = {
  Notas: ['Dia', 'Total', 'SAP', 'Pendente'],
  Faturamento: ['Dia da venda', 'Total', 'SAP', 'Pendente'],
} as const

function credenciaisSheets() {
  if (!coreConfig.GOOGLE_SHEETS_SPREADSHEET_ID || !coreConfig.GOOGLE_SHEETS_CREDENTIALS_FILE) {
    throw new Error('Busca CS ativa, mas GOOGLE_SHEETS_SPREADSHEET_ID ou GOOGLE_SHEETS_CREDENTIALS_FILE não foi configurado')
  }
  return {
    spreadsheetId: coreConfig.GOOGLE_SHEETS_SPREADSHEET_ID,
    auth: new google.auth.GoogleAuth({
      keyFile: coreConfig.GOOGLE_SHEETS_CREDENTIALS_FILE,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    })
  }
}

async function localizarOuCriarAba(api: sheets_v4.Sheets, spreadsheetId: string, ano: number, mes: number, tipo: 'Notas' | 'Faturamento') {
  const arquivo = await api.spreadsheets.get({ spreadsheetId, fields: 'sheets(properties(sheetId,title,gridProperties))' })
  const abas = arquivo.data.sheets ?? []
  const atual = nomeAba(ano, mes, tipo)
  const existente = abas.find(a => a.properties?.title === atual)
  if (existente?.properties?.sheetId != null) return existente.properties.sheetId

  const criada = await api.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title: atual } } }] },
  })
  const novoId = criada.data.replies?.[0]?.addSheet?.properties?.sheetId
  if (novoId == null) throw new Error(`Não foi possível criar a aba ${atual}`)
  await api.spreadsheets.values.update({
    spreadsheetId,
    range: intervaloAba(atual, 'A1:D1'),
    valueInputOption: 'RAW',
    requestBody: { values: [[...CABECALHOS_PROPRIOS[tipo]]] },
  })
  return novoId
}

async function encontrarCabecalho(api: sheets_v4.Sheets, spreadsheetId: string, aba: string, tipo: 'Notas' | 'Faturamento') {
  const resposta = await api.spreadsheets.values.get({ spreadsheetId, range: intervaloAba(aba, 'A1:ZZ100'), valueRenderOption: 'FORMULA' })
  const valores = resposta.data.values ?? []
  const headerApuracao = tipo === 'Notas' ? HEADER_NOTAS : HEADER_FATURAMENTO
  const linha = valores.findIndex(row =>
    row.some(celula => normalizar(celula) === headerApuracao) ||
    normalizar(row[0]) === normalizar(CABECALHOS_PROPRIOS[tipo][0]),
  )
  if (linha < 0) throw new Error(`Aba ${aba} sem cabeçalho de data`)
  const cabecalhos = valores[linha] ?? []
  const dataColuna = cabecalhos.findIndex(c =>
    normalizar(c) === headerApuracao || normalizar(c) === normalizar(CABECALHOS_PROPRIOS[tipo][0]),
  )
  const totalColuna = cabecalhos.findIndex(c => normalizar(c) === normalizar(CABECALHOS_PROPRIOS[tipo][1]))
  if (dataColuna < 0 || totalColuna < 0) {
    throw new Error(`Aba ${aba} sem os cabeçalhos necessários da Busca CS`)
  }
  return { linha, dataColuna, totalColuna }
}

async function atualizarAba(
  api: sheets_v4.Sheets,
  spreadsheetId: string,
  aba: string,
  tipo: 'Notas' | 'Faturamento',
  resumos: Awaited<ReturnType<typeof buscarResumoDiarioBuscaCS>>,
  ano: number,
  mes: number,
  diasNoMes: number,
  diaApuracao: number,
  diasAtualizar?: Set<string>,
) {
  const cabecalho = await encontrarCabecalho(api, spreadsheetId, aba, tipo)
  const valores = await api.spreadsheets.values.get({ spreadsheetId, range: intervaloAba(aba, 'A1:ZZ1000'), valueRenderOption: 'UNFORMATTED_VALUE' })
  const linhas = valores.data.values ?? []
  const datas = new Map<string, number>()
  for (let i = cabecalho.linha + 1; i < linhas.length; i++) {
    const valor = String(linhas[i]?.[cabecalho.dataColuna] ?? '')
    if (/^\d{1,2}\/\d{1,2}$/.test(valor)) datas.set(valor.padStart(5, '0'), i)
  }

  const requests: sheets_v4.Schema$ValueRange[] = []
  for (let dia = 1; dia <= diasNoMes; dia++) {
    const chave = `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`
    const indiceLinha = datas.get(chave) ?? cabecalho.linha + dia
    const deveAtualizar = !diasAtualizar || diasAtualizar.has(
      `${String(ano).padStart(4, '0')}${String(mes).padStart(2, '0')}${String(dia).padStart(2, '0')}`,
    )
    if (!diasAtualizar || deveAtualizar) {
      requests.push({ range: intervaloAba(aba, `${a1Coluna(cabecalho.dataColuna)}${indiceLinha + 1}`), values: [[chave]] })
    }
    if (dia <= diaApuracao && deveAtualizar) {
      const valor = tipo === 'Notas' ? resumos[dia - 1].totalNotas : resumos[dia - 1].valorBruto
      requests.push({ range: intervaloAba(aba, `${a1Coluna(cabecalho.totalColuna)}${indiceLinha + 1}`), values: [[valor]] })
    }
  }
  if (requests.length) await api.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: 'RAW', data: requests } })
}

export async function executarBuscaCS(d1?: string, diasParaAtualizar?: string[]): Promise<BuscaCSResult> {
  const { spreadsheetId, auth } = credenciaisSheets()
  const api = google.sheets({ version: 'v4', auth })
  const hoje = agoraEmSaoPaulo()
  const referencia = resolverPeriodoD1(d1 ?? dataAnterior(hoje.ano, hoje.mes, hoje.dia))
  const { ano, mes, diaApuracao, inicio, fim, diasNoMes } = referencia
  const resumos = await buscarResumoDiarioBuscaCS(inicio, fim, diasNoMes)
  const abaNotas = nomeAba(ano, mes, 'Notas')
  const abaFaturamento = nomeAba(ano, mes, 'Faturamento')
  await localizarOuCriarAba(api, spreadsheetId, ano, mes, 'Notas')
  await localizarOuCriarAba(api, spreadsheetId, ano, mes, 'Faturamento')
  const diasAtualizar = diasParaAtualizar ? new Set(diasParaAtualizar) : undefined
  await atualizarAba(api, spreadsheetId, abaNotas, 'Notas', resumos, ano, mes, diasNoMes, diaApuracao, diasAtualizar)
  await atualizarAba(api, spreadsheetId, abaFaturamento, 'Faturamento', resumos, ano, mes, diasNoMes, diaApuracao, diasAtualizar)

  const atual = resumos[diaApuracao - 1]
  const resultado = {
    aba: `${abaNotas} / ${abaFaturamento}`,
    dataApuracao: `${String(diaApuracao).padStart(2, '0')}/${String(mes).padStart(2, '0')}`,
    inicio,
    fim: dataAnterior(hoje.ano, hoje.mes, hoje.dia),
    totalNotas: atual.totalNotas,
    valorBruto: atual.valorBruto,
  }
  console.log('[BUSCA-CS][SHEETS] Planilhas atualizadas', resultado)
  return resultado
}
