import { buscarPedidosPluggto } from '../api/buscar-pedidos-pluggto'
import { reenviarPedidoPluggto } from './reenviar-pedidos-pluggto'
import { notifyGoogleChat } from '../../anymarket/notifications/google-chat'
import {
    buscarPedidosNaoIntegrados,
    salvarPedidosTempPluggto
} from '../repositories/pedidos.repository'

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
        return
    }

    const erros: Array<{ ordnoweb: string; error: string }> = []

    for (const pedido of naoIntegrados) {
        try {
            console.log(`[PLUGGTO][REENVIO] Reenviando pedido ${pedido.ordnoweb}`)
            await reenviarPedidoPluggto(pedido.ordnoweb)
        } catch (err: any) {
            const msg = err?.message || String(err)
            console.error(`[PLUGGTO][REENVIO] Falha no pedido ${pedido.ordnoweb}:`, msg)
            erros.push({ ordnoweb: pedido.ordnoweb, error: msg })
        }
    }

    if (erros.length) {
        await notifyGoogleChat(
            `
<b>❌ Falha ao reenviar pedidos Pluggto</b><br><br>
<pre>${JSON.stringify(erros, null, 2)}</pre>
`
        )
    }
}
