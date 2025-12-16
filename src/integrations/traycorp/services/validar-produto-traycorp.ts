import { TrayCorpProductBody } from "../../../shared/types";

export function produtoTraycorpEhValido(produto: TrayCorpProductBody): boolean {
  if (!produto.produtoId) return false;
  if (!produto.produtoVarianteId) return false;
  if (!produto.sku) return false;
  if (!produto.centroDistribuicaoId) return false;

  // estoque precisa existir e ser numérico
  if (
    produto.estoqueFisico === undefined ||
    produto.estoqueReservado === undefined
  ) {
    return false;
  }

  return true;
}
