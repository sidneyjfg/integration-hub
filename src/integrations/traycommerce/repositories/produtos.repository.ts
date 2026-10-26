// src/integrations/traycommerce/repositories/produtos.repository.ts
import { poolMonitoramento } from '../../../core/db'
import { coreConfig } from '../../../core/env.schema'
import { TraycommerceStockBody } from '../../../shared/types/traycommerce'

/**
 * Upsert do estoque. A tabela é acumulativa por `id_tray`: atualiza o que já
 * existe e insere o que é novo, sem janela em que a tabela fica vazia.
 */
export async function salvarEstoqueTraycommerce(
  produtos: TraycommerceStockBody[]
): Promise<number> {
  console.log(
    '[TRAYCOMMERCE][PRODUTOS][DB] Salvando estoque, aguarde...',
    { total: produtos.length }
  )

  if (!produtos.length) {
    console.log('[TRAYCOMMERCE][PRODUTOS][DB] Nenhum produto para salvar')
    return 0
  }

  const sql = `
    INSERT INTO ${coreConfig.DB_NAME_MONITORAMENTO}.temp_traycommerce_stock (
      id_tray,
      reference,
      name,
      stock,
      is_variant
    ) VALUES ?
    ON DUPLICATE KEY UPDATE
      reference = VALUES(reference),
      name = VALUES(name),
      stock = VALUES(stock),
      is_variant = VALUES(is_variant),
      updated_at = CURRENT_TIMESTAMP
  `

  const values = produtos.map(p => [
    p.id_tray,
    p.reference,
    p.name ?? null,
    p.stock ?? null,
    p.is_variant ? 1 : 0
  ])

  const [result] = await poolMonitoramento.query(sql, [values])

  const afetadas = (result as any).affectedRows ?? 0

  console.log('[TRAYCOMMERCE][PRODUTOS][DB] Estoque salvo/atualizado', {
    linhasAfetadas: afetadas
  })

  return afetadas
}
