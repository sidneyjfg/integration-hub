// src/integrations/traycorp/cron.ts
import { sincronizarProdutosTraycorp } from "./services/sincronizar-produtos-traycorp";

export async function executarCronProdutos() {
  await sincronizarProdutosTraycorp();
}
