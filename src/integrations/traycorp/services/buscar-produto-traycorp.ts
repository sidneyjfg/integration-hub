// src/integrations/traycorp/clients/buscar-produtos-traycorp.ts

import { TrayCorpProductBody } from "../../../shared/types";
import { buscarProdutosPaginadosTraycorp } from "../api/tray-client";

export async function buscarProdutosTraycorp(): Promise<TrayCorpProductBody[]> {
  const produtos: TrayCorpProductBody[] = [];

  console.log("[TRAYCORP][BUSCA] Iniciando busca de produtos");

  await buscarProdutosPaginadosTraycorp(async (paginaProdutos, pagina) => {
    console.log("[TRAYCORP][BUSCA] Página recebida", {
      pagina,
      quantidade: paginaProdutos.length,
    });

    produtos.push(...paginaProdutos);
  });

  console.log("[TRAYCORP][BUSCA] Busca finalizada", {
    totalProdutos: produtos.length,
  });

  return produtos;
}
