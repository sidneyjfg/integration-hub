// src/integrations/wake/utils.ts

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
    from: formatWakeDay(fromDate, '00:00:00'),
    to: formatWakeDay(today, '23:59:59')
  }
}

/** A Wake espera `aaaa-mm-dd hh:mm:ss`; o horario e sempre local. */
function formatWakeDay(date: Date, time: string) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day} ${time}`
}

/**
 * A API devolve a data em ISO 8601 (com fuso). O `Date` resultante e
 * gravado no MySQL no fuso do container, igual ao resto do repo.
 */
export function parseWakeDate(value: string | null | undefined): Date | null {
  if (!value) return null

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? null : date
}

/** `Number('')` é 0 e não null; o mysql2 devolve DECIMAL como string. */
export function paraNumeroOuNulo(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') {
    return null
  }

  const numero = Number(valor)

  return Number.isNaN(numero) ? null : numero
}
