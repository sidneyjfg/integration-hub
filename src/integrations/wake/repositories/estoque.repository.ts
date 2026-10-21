// src/integrations/wake/repositories/estoque.repository.ts
import { poolMonitoramento } from '../../../core/db'
import { coreConfig } from '../../../core/env.schema'
import { WakeStockBody } from '../../../shared/types/wake'

// O catalogo da Wake passa de 16 mil variantes; um unico INSERT desse tamanho
// vira um pacote enorme. Lotes de 500 mantem a query previsivel.
const TAMANHO_LOTE = 500

/**
 * Upsert do estoque por variante. Atualiza o que ja existe e insere o novo,
 * sem janela em que a tabela fica vazia.
 */
export async function salvarEstoqueWake(
  produtos: WakeStockBody[]
): Promise<number> {
  console.log('[WAKE][PRODUTOS][DB] Salvando estoque, aguarde...', {
    total: produtos.length
  })

  if (!produtos.length) {
    console.log('[WAKE][PRODUTOS][DB] Nenhum estoque para salvar')
    return 0
  }

  const sql = `
    INSERT INTO ${coreConfig.DB_NAME_MONITORAMENTO}.temp_wake_stock (
      produto_variante_id,
      sku,
      nome,
      estoque_fisico,
      estoque_reservado
    ) VALUES ?
    ON DUPLICATE KEY UPDATE
      sku = VALUES(sku),
      nome = VALUES(nome),
      estoque_fisico = VALUES(estoque_fisico),
      estoque_reservado = VALUES(estoque_reservado),
      updated_at = CURRENT_TIMESTAMP
  `

  let afetadas = 0

  for (let inicio = 0; inicio < produtos.length; inicio += TAMANHO_LOTE) {
    const lote = produtos.slice(inicio, inicio + TAMANHO_LOTE)

    const values = lote.map(p => [
      p.produto_variante_id,
      p.sku,
      p.nome,
      p.estoque_fisico,
      p.estoque_reservado
    ])

    const [result] = await poolMonitoramento.query(sql, [values])

    afetadas += (result as any).affectedRows ?? 0
  }

  console.log('[WAKE][PRODUTOS][DB] Estoque salvo/atualizado', {
    linhasAfetadas: afetadas
  })

  return afetadas
}
