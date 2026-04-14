type NotaNaoIntegrada = {
  NFE?: string
  SERIE?: string
  EMISSAO?: string | Date
}

export function buildNotasNaoIntegradasCard(
  notas: NotaNaoIntegrada[],
  clienteId: string
) {
  const widgets = notas.map(nota => {
    let dataFormatada = '-'

    if (nota.EMISSAO) {
      const valor = String(nota.EMISSAO)

      // AAAAMMDD
      if (/^\d{8}$/.test(valor)) {
        const ano = valor.slice(0, 4)
        const mes = valor.slice(4, 6)
        const dia = valor.slice(6, 8)
        dataFormatada = `${dia}/${mes}/${ano}`
      } else {
        const data = new Date(valor)
        dataFormatada = !isNaN(data.getTime())
          ? data.toLocaleString('pt-BR')
          : valor
      }
    }

    return {
      decoratedText: {
        startIcon: {
          knownIcon: "DESCRIPTION" // ícone de documento
        },
        text: `<b>${nota.NFE ?? '-'} / ${nota.SERIE ?? '-'}</b>`,
        bottomLabel: `📅 ${dataFormatada}`
      }
    }
  })

  return {
    cardsV2: [
      {
        cardId: "notas-nao-integradas",
        card: {
          header: {
            title: "⚠️ Notas não integradas",
            subtitle: `Mercado Livre • Conta ${clienteId}`,
          },
          sections: [
            {
              header: "Notas pendentes de integração",
              collapsible: true,
              uncollapsibleWidgetsCount: 5,
              widgets
            }
          ]
        }
      }
    ]
  }
}