type NotaNaoIntegrada = {
  NFE?: string
  SERIE?: string
  EMISSAO?: string | Date
}

export function buildNotaNaoIntegradaCard(
  nota: NotaNaoIntegrada,
  clienteId: string
) {
  const dataEmissao = nota.EMISSAO
    ? new Date(nota.EMISSAO).toLocaleDateString('pt-BR')
    : '-'

  return {
    header: {
      title: '⚠️ Nota não integrada',
      subtitle: `Mercado Livre • Conta ${clienteId}`
    },
    sections: [
      {
        widgets: [
          {
            keyValue: {
              topLabel: 'Nota / Série',
              content: `${nota.NFE ?? '-'} / ${nota.SERIE ?? '-'}`
            }
          },
          {
            keyValue: {
              topLabel: 'Data de emissão',
              content: dataEmissao
            }
          }
        ]
      }
    ]
  }
}
