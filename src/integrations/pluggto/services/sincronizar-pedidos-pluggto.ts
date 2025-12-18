import { buscarPedidosPluggto } from '../api/buscar-pedidos-pluggto'
import { reenviarPedidoPluggto } from './reenviar-pedidos-pluggto'
import {
    buscarPedidosNaoIntegrados,
    salvarPedidosTempPluggto
} from '../repositories/pedidos.repository'
import { pluggtoConfig } from '../env.schema'
import { notifyGoogleChat } from '../notifications/google-chat'

export async function sincronizarPedidosPluggto() {
    console.log('[PLUGGTO][SYNC] Iniciando pedidos')

    const pedidos = await buscarPedidosPluggto()

    if (pedidos.length === 0) {
        console.log('[PLUGGTO][SYNC] Nenhum pedido encontrado')
        return
    }

    await salvarPedidosTempPluggto(pedidos)

    const naoIntegrados = await buscarPedidosNaoIntegrados()

    if (!naoIntegrados.length) {
        console.log('[PLUGGTO][SYNC] Nenhum pedido pendente de integração')
        await notifyGoogleChat('✅ Todos os pedidos Pluggto foram integrados no Nérus')
        return
    }

    // 🚫 Reenvio desativado se URL não existir
    if (!pluggtoConfig.NERUS_RECEIVE_ORDER_URL) {
        console.warn('[PLUGGTO][SYNC] Reenvio desativado — NERUS_RECEIVE_ORDER_URL ausente')

        const linhas = naoIntegrados.map(p =>
            `• Pedido: ${p.ordnoweb}\n` +
            `  Status: ${p.status}\n` +
            `  Data: ${p.date}\n` +
            `  Valor: R$ ${p.total_paid?.toFixed(2) ?? '—'}`
        )


        await notifyGoogleChat(
            [
                '⚠️ *Pedidos Pluggto não integrados encontrados*',
                '',
                `Total: ${naoIntegrados.length}`,
                '',
                ...linhas
            ].join('\n')
        )

        return
    }

    // =========================
    // 🔁 Reenvio normal
    // =========================
    const erros: Array<{ ordnoweb: string; error: string }> = []

    for (const pedido of naoIntegrados) {
        try {
            console.log(`[PLUGGTO][REENVIO] Reenviando pedido ${pedido.ordnoweb}`)
            await reenviarPedidoPluggto(pedido.ordnoweb)
        } catch (err: any) {
            const msg = err?.message || String(err)
            console.error(
                `[PLUGGTO][REENVIO] Falha no pedido ${pedido.ordnoweb}:`,
                msg
            )
            erros.push({ ordnoweb: pedido.ordnoweb, error: msg })
        }
    }

    if (erros.length) {
        await notifyGoogleChat(
            [
                '❌ *Falha ao reenviar pedidos Pluggto*',
                '',
                `<pre>${JSON.stringify(erros, null, 2)}</pre>`
            ].join('\n')
        )
    }
}

