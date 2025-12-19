export function formatarDataEmissao(data?: string | Date): string {
  if (!data) return '-'

  if (data instanceof Date && !isNaN(data.getTime())) {
    return data.toLocaleDateString('pt-BR')
  }

  if (typeof data === 'string') {
    // tenta yyyy-mm-dd
    const iso = data.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (iso) {
      return `${iso[3]}/${iso[2]}/${iso[1]}`
    }

    // tenta yyyymmdd
    const compact = data.match(/^(\d{4})(\d{2})(\d{2})$/)
    if (compact) {
      return `${compact[3]}/${compact[2]}/${compact[1]}`
    }
  }

  return '-'
}
