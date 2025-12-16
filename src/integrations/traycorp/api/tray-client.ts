// src/integrations/traycorp/clients/tray-client.ts
import axios from "axios";
import { trayConfig } from "../env.schema";

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const RATE_LIMIT = 120;
const WINDOW_MS = 60000;

/**
 * 🔁 Busca uma página com retry e backoff (429)
 */
async function buscarPaginaComRetry(
    urlFinal: string,
    token: string,
    pagina: number
) {
    let tentativas = 0;
    const maxTentativas = 5;

    while (true) {
        try {
            const response = await axios.get(urlFinal, {
                headers: {
                    Authorization: `Basic ${token}`,
                    Accept: "application/json",
                },
                timeout: 15000,
            });

            return response.data;

        } catch (erro: any) {
            const status = erro.response?.status;

            if (status !== 429) {
                console.error(`[TRAYCORP][BUSCA] Erro na página ${pagina}`, erro.message);
                throw erro;
            }

            tentativas++;

            if (tentativas > maxTentativas) {
                throw new Error("Rate limit persistente na TrayCorp");
            }

            const backoff = Math.min(60, 5 * Math.pow(2, tentativas));
            console.log(
                `[TRAYCORP][BUSCA] Rate limit (429). Tentativa ${tentativas}/${maxTentativas}. Aguardando ${backoff}s`
            );

            await sleep(backoff * 1000);
        }
    }
}

/**
 * 🔎 Busca produtos da TrayCorp paginados
 */
export async function buscarProdutosPaginadosTraycorp(
    aoProcessarPagina: (produtos: any[], pagina: number) => Promise<void>
): Promise<number> {

    const baseUrl = trayConfig.TRAY_URL || "";
    const token = trayConfig.TRAY_TOKEN || "";

    if (!baseUrl || !token) {
        throw new Error("TRAY_URL ou TRAY_TOKEN não configurados");
    }

    let pagina = 1;
    let requisicoes = 0;
    let inicioJanela = Date.now();

    while (true) {
        const agora = Date.now();

        if (agora - inicioJanela >= WINDOW_MS) {
            requisicoes = 0;
            inicioJanela = agora;
        }

        if (requisicoes >= RATE_LIMIT) {
            const espera = WINDOW_MS - (agora - inicioJanela);
            console.log(`[TRAYCORP][BUSCA] Rate limit local atingido. Esperando ${Math.ceil(espera / 1000)}s`);
            await sleep(espera);
            continue;
        }

        const urlFinal =
            `${baseUrl.replace(/\/+$/, "")}/produtos?camposAdicionais=estoque&pagina=${pagina}`;

        console.log(`[TRAYCORP][BUSCA] Buscando página ${pagina}`);

        requisicoes++;

        let dados: any[];

        try {
            dados = await buscarPaginaComRetry(urlFinal, token, pagina);
        } catch (erro: any) {
            const status = erro.response?.status;
            if (status === 404 || status === 429) break;
            throw erro;
        }

        if (!Array.isArray(dados) || dados.length === 0) {
            console.log(`[TRAYCORP][BUSCA] Página ${pagina} vazia. Fim.`);
            break;
        }

        await aoProcessarPagina(dados, pagina);
        pagina++;
    }

    return pagina - 1;
}
