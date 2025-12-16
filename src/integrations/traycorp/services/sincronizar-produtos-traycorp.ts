import { notifyGoogleChat } from "../../anymarket/notifications/google-chat";
import { salvarProdutosTempTraycorp } from "../repositories/produtos.repository";
import { buscarProdutosTraycorp } from "./buscar-produto-traycorp";
import { produtoTraycorpEhValido } from "./validar-produto-traycorp";

export async function sincronizarProdutosTraycorp() {
  console.log("[TRAYCORP][SYNC] Iniciando sincronização de produtos");

  const produtos = await buscarProdutosTraycorp();

  let invalidos = 0;
  const validos = [];

  for (const produto of produtos) {
    if (!produtoTraycorpEhValido(produto)) {
      invalidos++;
      continue;
    }

    validos.push(produto);
  }

  if (validos.length === 0) {
    console.log("[TRAYCORP][SYNC] Nenhum produto válido encontrado");

    await notifyGoogleChat(
      "⚠️ Nenhum produto válido encontrado na TrayCorp."
    );

    return {
      inseridos: 0,
      invalidos,
    };
  }

  const inseridos = await salvarProdutosTempTraycorp(validos);

  console.log("[TRAYCORP][SYNC] Sincronização finalizada", {
    inseridos,
    invalidos,
  });

  return {
    inseridos,
    invalidos,
  };
}
