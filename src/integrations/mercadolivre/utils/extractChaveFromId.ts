/**
 * Remove o prefixo "NFe" de um identificador, se existir.
 * Exemplo:
 *  - "NFe351234..." → "351234..."
 *  - "351234..."    → "351234..."
 */
export default function extractChaveFromId(id: string): string {
  if (!id) return id

  return id.startsWith('NFe') ? id.slice(3) : id
}
