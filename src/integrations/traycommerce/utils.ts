// src/integrations/traycommerce/utils.ts

/**
 * Janela de busca de pedidos.
 * Segunda-feira volta 3 dias para cobrir sexta, sabado e domingo; nos demais
 * dias, 1 dia. O fim sempre e o dia atual, para o que entra depois do cron
 * nao ficar de fora: o ciclo seguinte repete o dia anterior.
 * O dia da semana usa o fuso do container (TZ: America/Sao_Paulo no compose).
 */
export function getDateRange() {
  const today = new Date()
  const daysToFetch = today.getDay() === 1 ? 3 : 1

  const fromDate = new Date(today)
  fromDate.setDate(today.getDate() - daysToFetch)

  return {
    from: formatTrayDate(fromDate),
    to: formatTrayDate(today)
  }
}

/** A TrayCommerce espera o período no formato YYYYMMDD, sem traço. */
function formatTrayDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}${month}${day}`
}
