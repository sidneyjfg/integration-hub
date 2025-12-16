import { ContextoLogSincronizacaoPedidos } from "../../../shared/types";

export async function registrarLogSincronizacaoPedidosAnymarket(
  contexto: ContextoLogSincronizacaoPedidos,
  statusCode: number
): Promise<void> {
  // aqui você pode:
  // - enviar para logger
  // - salvar em tabela
  // - console.log
  console.log('LOG SINCRONIZAÇÃO ANYMARKET', {
    statusCode,
    contexto
  })
}
