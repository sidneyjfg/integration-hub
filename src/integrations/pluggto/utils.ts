export function getDateRange() {
  const today = new Date()
  const daysToFetch = Number(process.env.DAYS_TO_FETCH || 1)

  const fromDate = new Date(today)
  fromDate.setDate(today.getDate() - daysToFetch)

  const format = (date: Date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  return {
    from: format(fromDate),
    to: format(today),
  }
}
