import {
  salvarNotasTmpMercadoLivre,
  buscarNotasNaoIntegradasNerusPorChaves,
  verificarECriarTabelaTmpNotas,
  buscarCredenciaisMercadoLivre,
  getRetryCountFfpreprocnf,
  zerarRetryCountFfpreprocnf,
} from "../repositories/mercadolivre-notas.repository";
import {
  notifyGoogleChat,
  notifyGoogleChatError,
  notifyGoogleChatWarning,
} from "../notifications/google-chat";
import { buscarNotasMercadoLivre } from "../api/buscar-notas-mercadolivre";
import { mercadolivreConfig } from "../env.schema";
import { buildNotasNaoIntegradasCard } from "../notifications/build-notas-notification";

interface RetryResult {
  notasParaRevisao: Array<{ CHAVE_NFE?: string }>;
  zeradas: number;
}

async function processarRetryNotasNaoIntegradas(
  notasNaoIntegradas: Array<{ CHAVE_NFE?: string }>,
): Promise<RetryResult> {
  const maxRetryCount = mercadolivreConfig.MERCADOLIVRE_MAX_RETRY_COUNT;

  const resultado: RetryResult = {
    notasParaRevisao: [],
    zeradas: 0,
  };

  if (maxRetryCount == null) {
    resultado.notasParaRevisao = notasNaoIntegradas;
    return resultado;
  }

  let avaliadas = 0;
  let ignoradas = 0;
  let semRetryCount = 0;

  for (const nota of notasNaoIntegradas) {
    const nfeKey = nota.CHAVE_NFE;

    if (!nfeKey) {
      ignoradas++;
      resultado.notasParaRevisao.push(nota);
      continue;
    }

    const retryCount = await getRetryCountFfpreprocnf({ nfeKey });
    avaliadas++;

    if (retryCount == null) {
      semRetryCount++;
      resultado.notasParaRevisao.push(nota);
      continue;
    }

    if (retryCount >= maxRetryCount) {
      const affectedRows = await zerarRetryCountFfpreprocnf({ nfeKey });
      if (affectedRows > 0) {
        resultado.zeradas++;
      } else {
        resultado.notasParaRevisao.push(nota);
      }
      continue;
    }

    ignoradas++;
    resultado.notasParaRevisao.push(nota);
  }

  console.log("[MERCADOLIVRE][SYNC][RETRY] Processamento finalizado", {
    maxRetryCount,
    avaliadas,
    zeradas: resultado.zeradas,
    ignoradas,
    semRetryCount,
  });

  return resultado;
}

export async function sincronizarNotasMercadoLivre(): Promise<void> {
  console.log("[MERCADOLIVRE][SYNC] Iniciando sincronização de notas");

  try {
    console.log("[MERCADOLIVRE][SYNC] Verificando tabela tmp_notas");
    await verificarECriarTabelaTmpNotas();
    console.log("[MERCADOLIVRE][SYNC] Tabela tmp_notas OK");

    const contas = await buscarCredenciaisMercadoLivre();

    if (!contas.length) {
      throw new Error(
        "[MERCADOLIVRE] Nenhuma credencial válida encontrada no banco",
      );
    }

    for (const conta of contas) {
      const clienteId = conta.clienteId;
      const accessToken = conta.accessToken;
      const refreshToken = conta.refreshToken;
      const clientId = conta.clientId;
      const clientSecret = conta.clientSecret;

      console.log("\n==============================");
      console.log("[MERCADOLIVRE][SYNC] Iniciando cliente", { clienteId });
      console.log("==============================");

      try {
        const { notas } = await buscarNotasMercadoLivre({
          clienteId,
          clientId,
          clientSecret,
          accessToken,
          refreshToken,
          sftpMode: false,
        });
        const chavesCliente = notas.map((n) => n.chave);

        console.log("[MERCADOLIVRE][SYNC][BUSCA FINALIZADA]", {
          clienteId,
          totalNotas: notas.length,
        });

        if (notas.length === 0) {
          console.log("[MERCADOLIVRE][SYNC] Nenhuma nota encontrada", {
            clienteId,
          });
          await notifyGoogleChatWarning(
            `⚠️ Nenhuma nota fulfillment encontrada para a cliente: ${mercadolivreConfig.CLIENT_NAME} - ${clienteId}.`,
          );
          continue;
        }

        console.log("[MERCADOLIVRE][SYNC][DB] Iniciando inserção", {
          clienteId,
          totalNotas: notas.length,
          chavesExemplo: notas.slice(0, 5).map((n) => n.chave),
        });

        const insertedCount = await salvarNotasTmpMercadoLivre(notas);

        console.log("[MERCADOLIVRE][SYNC][DB] Inserção finalizada", {
          clienteId,
          insertedCount,
        });

        console.log("[MERCADOLIVRE][SYNC][DB] Buscando notas não integradas");
        const notasNaoIntegradas =
          await buscarNotasNaoIntegradasNerusPorChaves(chavesCliente);

        console.log("[MERCADOLIVRE][SYNC][DB] Resultado comparação", {
          clienteId,
          totalNaoIntegradas: notasNaoIntegradas.length,
        });

        if (notasNaoIntegradas.length > 0) {
          const { notasParaRevisao, zeradas } =
            await processarRetryNotasNaoIntegradas(notasNaoIntegradas);

          if (zeradas > 0) {
            await notifyGoogleChat(
              `🔄 Auto-cura: ${zeradas} nota(s) tiveram o contador zerado e tentarão integrar novamente (Cliente: ${mercadolivreConfig.CLIENT_NAME} - Conta ${clienteId}).`,
            );
          }

          if (notasParaRevisao.length > 0) {
            const mensagemRevisao = `${notasParaRevisao.length} nota(s) do Mercado Livre excederam o limite de tentativas ou falharam e precisam de revisão manual no Nérus (Cliente: ${mercadolivreConfig.CLIENT_NAME} - Conta ${clienteId}).`;

            if (notasParaRevisao.length > 300) {
              await notifyGoogleChatError(`❌ ${mensagemRevisao}`);
            } else {
              await notifyGoogleChatWarning(`⚠️ ${mensagemRevisao}`);
            }

            // const card = buildNotasNaoIntegradasCard(
            //   notasParaRevisao,
            //   clienteId,
            // );

            // await notifyGoogleChatWarning(card);
          }
        } else {
          await notifyGoogleChat(
            `✅ Todas as notas do Mercado Livre já constam integradas no Nérus (Cliente: ${mercadolivreConfig.CLIENT_NAME} - Conta ${clienteId}).`,
          );
        }

        console.log("[MERCADOLIVRE][SYNC] Cliente finalizado com sucesso", {
          clienteId,
        });
      } catch (erroCliente) {
        console.error("[MERCADOLIVRE][SYNC][CLIENTE ERRO]", {
          clienteId,
          erro: erroCliente,
        });

        await notifyGoogleChatError(
          `❌ Erro ao processar notas do Mercado Livre para o cliente: ${mercadolivreConfig.CLIENT_NAME} - Conta ${clienteId}.`,
        );
      }
    }

    console.log("[MERCADOLIVRE][SYNC] Sincronização geral finalizada");
  } catch (erro) {
    console.error("[MERCADOLIVRE][SYNC] ERRO GERAL", erro);

    await notifyGoogleChatError(
      "Erro geral ao executar sincronização de notas do Mercado Livre.",
    );

    throw erro;
  }
}
