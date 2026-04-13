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

      // 🔥 caso AAAAMMDD (ex: 20260413)
      if (/^\d{8}$/.test(valor)) {
        const ano = valor.slice(0, 4)
        const mes = valor.slice(4, 6)
        const dia = valor.slice(6, 8)
        dataFormatada = `${dia}/${mes}/${ano}`
      } else {
        // fallback (datetime ou outro formato)
        const data = new Date(valor)
        if (!isNaN(data.getTime())) {
          dataFormatada = data.toLocaleString('pt-BR')
        } else {
          dataFormatada = valor
        }
      }
    }

    return {
      textParagraph: {
        text: `
          <b style="font-size:16px">
            ${nota.NFE ?? '-'} / ${nota.SERIE ?? '-'}
          </b><br/>
          <font color="#888888" size="2">
            ${dataFormatada}
          </font>
        `
      }
    }
  })

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