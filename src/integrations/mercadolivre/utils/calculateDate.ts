/**
 * Retorna data no formato YYYYMMDD
 */
export default function calculateDate(daysAgo: number): string {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return date.toISOString().split('T')[0].replace(/-/g, '')
}
