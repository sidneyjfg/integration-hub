import { parseISO, format, addHours } from 'date-fns'
import extractChaveFromId from './extractChaveFromId'
import { MercadoLivreNotaBody } from '../../../shared/types'

function formatEmissao(emissaoISO?: string): string | null {
  if (!emissaoISO) return null
  const parsed = parseISO(emissaoISO)
  const adjusted = addHours(parsed, 3)
  return format(adjusted, 'dd/MM/yyyy HH:mm:ss')
}

function getNotaStatus(xml: any): { status: string; motivo: string } {
  const prot =
    xml?.nfeProc?.protNFe?.[0]?.infProt?.[0] ??
    xml?.retEnviNFe?.infProt?.[0]

  if (!prot) {
    return { status: 'Desconhecido', motivo: 'Status não encontrado' }
  }

  const cStat = prot.cStat?.[0]
  const xMotivo = prot.xMotivo?.[0] ?? 'Desconhecido'

  const map: Record<string, string> = {
    '100': 'Autorizada',
    '101': 'Cancelada',
    '102': 'Inutilizada',
    '110': 'Denegada'
  }

  return {
    status: map[cStat] ?? xMotivo,
    motivo: xMotivo
  }
}

export default function extractOrderDataFromXML(
  xml: any,
  fileName: string
): MercadoLivreNotaBody[] {
  console.log(`[EXTRACT] Processando ${fileName}`)

  const infNFe = xml?.nfeProc?.NFe?.[0]?.infNFe?.[0]
  if (!infNFe) return []

  const chave =
    infNFe.$?.Id ? extractChaveFromId(infNFe.$.Id) : 'Desconhecido'

  const status = getNotaStatus(xml).status
  const vendaRemessa = infNFe['det']?.[0]?.['infAdProd']?.[0]?.match(/\d+/)?.[0] || 'Desconhecido';
  const nfeNumero = infNFe.ide?.[0]?.nNF?.[0]
  const serie = infNFe.ide?.[0]?.serie?.[0]
  const nome = infNFe.dest?.[0]?.xNome?.[0]
  const emissao = formatEmissao(infNFe.ide?.[0]?.dhEmi?.[0])
  const valor = infNFe.total?.[0]?.ICMSTot?.[0]?.vProd?.[0]
  const valorTotal = infNFe.total?.[0]?.ICMSTot?.[0]?.vNF?.[0]
  const frete = infNFe.total?.[0]?.ICMSTot?.[0]?.vFrete?.[0]

  const modalidade = infNFe.dest?.[0]?.CNPJ
    ? 'B2B'
    : infNFe.dest?.[0]?.CPF
      ? 'B2C'
      : 'Desconhecido'

  const natOp = infNFe.ide?.[0]?.natOp?.[0] ?? ''
  const natNorm = natOp.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  const tipoLogistico = natNorm.includes(
    'Venda de mercadoria para consumidor final'
  )
    ? 'Cross Docking'
    : 'Fulfillment'

  return [
    {
      status,
      venda_remessa: vendaRemessa,
      NFe: nfeNumero,
      serie,
      nome,
      chave,
      modalidade,
      operacao: natOp,
      emissao,
      valor,
      valor_total: valorTotal,
      frete,
      tipo_logistico: tipoLogistico
    }
  ]
}
