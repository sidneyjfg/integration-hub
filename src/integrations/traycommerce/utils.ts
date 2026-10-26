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

/**
 * Converte a janela da API (YYYYMMDD) no formato que o MySQL entende
 * (YYYY-MM-DD HH:MM:SS).
 *
 * Os dois formatos não podem ser misturados: `CONCAT('20261001', ' 00:00:00')`
 * produz a string '20261001 00:00:00', e o MySQL não converte isso para
 * DATETIME porque a data não tem traço (ER_WRONG_VALUE 1525). A conversão
 * fica em JS para ficar verificável sem banco em lugar nenhum.
 *
 * Só métodos UTC: a mesma armadilha do `new Date('2022-05-10')`, que é
 * meia-noite UTC e portanto dia anterior em São Paulo, não pode aparecer aqui.
 */
export function paraInicioDiaSql(data: string): string {
  return formatarDataSql(
    Date.UTC(Number(data.slice(0, 4)), Number(data.slice(4, 6)) - 1, Number(data.slice(6, 8)))
  );
}

/**
 * Limite exclusivo: o dia seguinte ao `to`. A janela da API é inclusiva nos
 * dois extremos, então comparamos com `<` para pegar o `to` inteiro sem
 * depender de 23:59:59. `Date.UTC` transborda mês e ano sozinho, então
 * 28/02 vira 01/03 e 31/12 vira 01/01 sem caso especial.
 */
export function paraFimExclusivoSql(data: string): string {
  return formatarDataSql(
    Date.UTC(Number(data.slice(0, 4)), Number(data.slice(4, 6)) - 1, Number(data.slice(6, 8)) + 1)
  );
}

function formatarDataSql(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day} 00:00:00`;
}
