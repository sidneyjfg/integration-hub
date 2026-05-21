import {
  notifyGoogleChat,
  notifyGoogleChatError,
  notifyGoogleChatWarning,
} from "../../anymarket/notifications/google-chat";
import { salvarProdutosTempTraycorp } from "../repositories/produtos.repository";
import { buscarProdutosTraycorp } from "./buscar-produto-traycorp";
import { produtoTraycorpEhValido } from "./validar-produto-traycorp";
import { TrayCorpProductBody } from "../../../shared/types";

export async function sincronizarProdutosTraycorp() {
  console.log("[TRAYCORP][SYNC] Iniciando sincronização de produtos");

  const produtos: TrayCorpProductBody[] = await buscarProdutosTraycorp();
  const totalBuscados = produtos.length;

  let invalidos = 0;
  const validos: TrayCorpProductBody[] = [];

  for (const produto of produtos) {
    if (!produtoTraycorpEhValido(produto)) {
      invalidos++;
      continue;
    }
    validos.push(produto);
  }

  if (validos.length === 0) {
    console.log("[TRAYCORP][SYNC] Nenhum produto válido encontrado");

    await notifyGoogleChatWarning(
      `⚠️ *TrayCorp – Sincronização de Produtos*\n\n` +
        `Total buscados: ${totalBuscados}\n` +
        `Produtos válidos: 0\n` +
        `Produtos inválidos: ${invalidos}\n\n` +
        `Nenhum produto foi inserido.`,
    );

    return { totalBuscados, inseridos: 0, invalidos };
  }

  const inseridos = await salvarProdutosTempTraycorp(validos);

  console.log("[TRAYCORP][SYNC] Sincronização finalizada", {
    totalBuscados,
    inseridos,
    invalidos,
  });

  await notifyGoogleChat(
    `📦 *TrayCorp – Sincronização de Produtos*\n\n` +
      `Total buscados: ${totalBuscados}\n` +
      `Produtos válidos: ${validos.length}\n` +
      `Produtos inseridos: ${inseridos}\n` +
      `Produtos inválidos (nao foram inseridos): ${invalidos}`,
  );

  return { totalBuscados, inseridos, invalidos };
}
