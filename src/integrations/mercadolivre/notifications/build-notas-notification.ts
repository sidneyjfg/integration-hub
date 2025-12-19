import { formatarDataEmissao } from "../utils/format-time"

type NotaNaoIntegrada = {
  NFE?: string
  SERIE?: string
  EMISSAO?: string | Date
}

export function buildNotasNaoIntegradasCard(
  notas: NotaNaoIntegrada[],
  clienteId: string
) {
  const widgets = notas.map(nota => ({
    keyValue: {
      topLabel: `${nota.NFE ?? '-'} / ${nota.SERIE ?? '-'}`,
      content: `📅 ${formatarDataEmissao(nota.EMISSAO)}`
    }
  }))

  return {
    header: {
      title: '⚠️ Notas não integradas',
      subtitle: `Mercado Livre • Conta ${clienteId}`
    },
    sections: [
      {
        widgets
      }
    ]
  }
}
