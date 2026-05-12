import { atualizarNfcacheEtiquetaDiaAtual } from '../repositories/mercadolivre-notas.repository'

export async function sincronizarEtiquetaMercadoLivre(): Promise<void> {
  console.log('[MERCADOLIVRE][ETIQUETA] Iniciando atualização do nfcache')

  const affectedRows = await atualizarNfcacheEtiquetaDiaAtual()

  console.log('[MERCADOLIVRE][ETIQUETA] nfcache atualizado', {
    affectedRows
  })
}
