// src/integrations/wake/repositories/precos.repository.ts
import { poolMonitoramento } from '../../../core/db'
import { coreConfig } from '../../../core/env.schema'
import { WakePriceBody } from '../../../shared/types/wake'

// O catalogo da Wake passa de 16 mil variantes; um unico INSERT desse tamanho
// vira um pacote enorme. Lotes de 500 mantem a query previsivel.
const TAMANHO_LOTE = 500

/**
 * Upsert do preco por variante. Atualiza o que ja existe e insere o novo,
 * sem janela em que a tabela fica vazia.
 */
export async function salvarPrecosWake(
  produtos: WakePriceBody[]
): Promise<number> {
  console.log('[WAKE][PRODUTOS][DB] Salvando preços, aguarde...', {
    total: produtos.length
  })

  if (!produtos.length) {
    console.log('[WAKE][PRODUTOS][DB] Nenhum preço para salvar')
    return 0
  }

  const sql = `
    INSERT INTO ${coreConfig.DB_NAME_MONITORAMENTO}.temp_wake_price (
      produto_variante_id,
      produto_id,
      id_pai_externo,
      id_vinculo_externo,
      sku,
      nome,
      preco_custo,
      preco_de,
      preco_por,
      fator_multiplicador_preco,
      valido
    ) VALUES ?
    ON DUPLICATE KEY UPDATE
      produto_id = VALUES(produto_id),
      id_pai_externo = VALUES(id_pai_externo),
      id_vinculo_externo = VALUES(id_vinculo_externo),
      sku = VALUES(sku),
      nome = VALUES(nome),
      preco_custo = VALUES(preco_custo),
      preco_de = VALUES(preco_de),
      preco_por = VALUES(preco_por),
      fator_multiplicador_preco = VALUES(fator_multiplicador_preco),
      valido = VALUES(valido),
      updated_at = CURRENT_TIMESTAMP
  `

  let afetadas = 0

  for (let inicio = 0; inicio < produtos.length; inicio += TAMANHO_LOTE) {
    const lote = produtos.slice(inicio, inicio + TAMANHO_LOTE)

    const values = lote.map(p => [
      p.produto_variante_id,
      p.produto_id,
      p.id_pai_externo,
      p.id_vinculo_externo,
      p.sku,
      p.nome,
      p.preco_custo,
      p.preco_de,
      p.preco_por,
      p.fator_multiplicador_preco,
      p.valido
    ])

    const [result] = await poolMonitoramento.query(sql, [values])

    afetadas += (result as any).affectedRows ?? 0
  }

  console.log('[WAKE][PRODUTOS][DB] Preços salvos/atualizados', {
    linhasAfetadas: afetadas
  })

  return afetadas
}

/**
 * Remove linhas que nao foram atualizadas neste ciclo. Como so os produtos
 * validos entram no upsert, quem virou invalido ou perdeu o ID Nérus fica
 * com `updated_at` antigo e sai da tabela.
 */
export async function removerPrecosNaoAtualizadosWake(
  desde: Date
): Promise<number> {
  const sql = `
    DELETE FROM ${coreConfig.DB_NAME_MONITORAMENTO}.temp_wake_price
    WHERE updated_at < ?
  `

  const [result] = await poolMonitoramento.query(sql, [desde])
  const removidas = (result as any).affectedRows ?? 0

  console.log('[WAKE][PRODUTOS][DB] Preços antigos removidos', {
    removidas
  })

  return removidas
}
