import { mercadolivreConfig } from "../env.schema"

/**
 * Verifica se a série da nota está configurada para ser ignorada.
 * A variável de ambiente IGNORE_SERIE deve conter uma lista separada por vírgula.
 *
 * Exemplo:
 *   IGNORE_SERIE=900,901,999
 */
export default function isSerieIgnorada(serie?: string | null): boolean {
  if (!serie) return false

  const ignoreSeries = (mercadolivreConfig.MERCADOLIVRE_IGNORE_SERIE ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  return ignoreSeries.includes(serie)
}
