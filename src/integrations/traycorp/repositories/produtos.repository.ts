import { poolMonitoramento } from "../../../core/db";
import { coreConfig } from "../../../core/env.schema";
import { TrayCorpProductBody } from "../../../shared/types";

export async function salvarProdutosTempTraycorp(
  produtos: TrayCorpProductBody[]
): Promise<number> {

  if (produtos.length === 0) {
    console.log("[TRAYCORP][DB] Nenhum produto para salvar.");
    return 0;
  }

  const sql = `
    INSERT INTO ${coreConfig.DB_NAME_MONITORAMENTO}.temp_products (
      produtoVarianteId, produtoId, idPaiExterno,
      sku, nome, nomeProdutoPai,
      precoCusto, precoDe, precoPor,
      ean,
      centroDistribuicaoId, estoqueFisico, estoqueReservado, alertaEstoque,
      dataCriacao, dataAtualizacao,
      parentId, raw_payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      precoCusto = VALUES(precoCusto),
      precoDe = VALUES(precoDe),
      precoPor = VALUES(precoPor),
      estoqueFisico = VALUES(estoqueFisico),
      estoqueReservado = VALUES(estoqueReservado),
      alertaEstoque = VALUES(alertaEstoque),
      dataAtualizacao = VALUES(dataAtualizacao),
      raw_payload = VALUES(raw_payload)
  `;

  try {
    for (const produto of produtos) {
      const estoque = produto.estoque?.[0];
      if (!estoque) continue;

      await poolMonitoramento.execute(sql, [
        produto.produtoVarianteId ?? null,
        produto.produtoId ?? null,
        produto.idPaiExterno ?? null,
        produto.sku ?? null,
        produto.nome ?? null,
        produto.nomeProdutoPai ?? null,
        produto.precoCusto ?? null,
        produto.precoDe ?? null,
        produto.precoPor ?? null,
        produto.ean ?? null,
        estoque.centroDistribuicaoId ?? null,
        estoque.estoqueFisico ?? null,
        estoque.estoqueReservado ?? null,
        estoque.alertaEstoque ?? null,
        produto.dataCriacao ?? null,
        produto.dataAtualizacao ?? null,
        produto.parentId ?? null,
        JSON.stringify(produto.raw_payload ?? produto),
      ]);
    }

    console.log(`[TRAYCORP][DB] ${produtos.length} produtos salvos/atualizados`);
    return produtos.length;

  } catch (erro) {
    console.error("[TRAYCORP][DB] Erro ao salvar produtos:", erro);
    throw erro;
  }
}
