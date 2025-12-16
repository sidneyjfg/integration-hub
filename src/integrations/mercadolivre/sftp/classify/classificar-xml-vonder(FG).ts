export function isEventoNFe(filePath = '') {
  const n = filePath.toLowerCase()
  if (n.includes('ct_e') || n.includes('cte')) return false
  if (n.includes('procevento')) return true
  if (n.includes('evento') && !n.includes('procnfe')) return true
  if (n.includes('inutnfe')) return true
  return false
}

export function isCTe(filePath = '') {
  const n = filePath.toLowerCase()
  return n.includes('cte') || n.includes('ct_e')
}

export function isParaIN(filePath = '') {
  return !isEventoNFe(filePath) && !isCTe(filePath)
}
