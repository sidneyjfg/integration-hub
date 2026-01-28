import { TrayCorpProductBody } from "../../../shared/types";

export function produtoTraycorpEhValido(
  produto: TrayCorpProductBody
): boolean {

  if (!produto.produtoId) return false;
  if (!produto.produtoVarianteId) return false;
  if (!produto.sku) return false;

  const estoque = produto.estoque?.[0];
  if (!estoque) return false;

  if (!estoque.centroDistribuicaoId) return false;

  if (
    estoque.estoqueFisico === undefined ||
    estoque.estoqueReservado === undefined
  ) {
    return false;
  }

  return true;
}
