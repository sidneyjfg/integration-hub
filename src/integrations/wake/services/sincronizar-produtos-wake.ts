// src/integrations/wake/services/sincronizar-produtos-wake.ts
import { buscarProdutosWake } from '../api/wake-client'
import {
  removerPrecosNaoAtualizadosWake,
  salvarPrecosWake
} from '../repositories/precos.repository'
import {
  removerEstoqueNaoAtualizadosWake,
  salvarEstoqueWake
} from '../repositories/estoque.repository'
import {
  notifyGoogleChat,
  notifyGoogleChatWarning
} from '../notifications/google-chat'
import { paraNumeroOuNulo } from '../utils'
import { agoraMonitoramento } from '../../../core/db'
import {
  WakePriceBody,
  WakeProductApi,
  WakeStockBody
} from '../../../shared/types/wake'

function textoOuNulo(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null

  const texto = String(valor).trim()

  return texto ? texto : null
}

function paraInteiroOuNulo(valor: unknown): number | null {
  const numero = paraNumeroOuNulo(valor)

  return numero === null ? null : Math.trunc(numero)
}

function paraPrecoBody(
  produto: WakeProductApi,
  produtoVarianteId: number,
  idVinculoExterno: string
): WakePriceBody {
  return {
    produto_variante_id: produtoVarianteId,
    produto_id: paraInteiroOuNulo(produto.produtoId),
    id_pai_externo: textoOuNulo(produto.idPaiExterno),
    id_vinculo_externo: idVinculoExterno,
    sku: textoOuNulo(produto.sku) ?? '',
    nome: textoOuNulo(produto.nome),
    preco_custo: paraNumeroOuNulo(produto.precoCusto),
    preco_de: paraNumeroOuNulo(produto.precoDe),
    preco_por: paraNumeroOuNulo(produto.precoPor),
    fator_multiplicador_preco: paraNumeroOuNulo(
      produto.fatorMultiplicadorPreco
    ),
    // Só produtos válidos chegam aqui; a coluna fica para compatibilidade
    // com quem já filtra `valido = 1` no ERP.
    valido: 1
  }
}

/**
 * A API devolve o estoque por centro de distribuicao; a linha do monitoramento
 * e por variante, com a soma dos centros. Array vazio e estoque zero; array
 * ausente e desconhecido (null) e nao vira zero.
 */
function paraEstoqueBody(
  produto: WakeProductApi,
  produtoVarianteId: number,
  idVinculoExterno: string
): WakeStockBody {
  let estoqueFisico: number | null = null
  let estoqueReservado: number | null = null

  if (Array.isArray(produto.estoque)) {
    estoqueFisico = 0
    estoqueReservado = 0

    for (const item of produto.estoque) {
      estoqueFisico += paraNumeroOuNulo(item?.estoqueFisico) ?? 0
      estoqueReservado += paraNumeroOuNulo(item?.estoqueReservado) ?? 0
    }
  }

  return {
    produto_variante_id: produtoVarianteId,
    id_pai_externo: textoOuNulo(produto.idPaiExterno),
    id_vinculo_externo: idVinculoExterno,
    sku: textoOuNulo(produto.sku) ?? '',
    nome: textoOuNulo(produto.nome),
    estoque_fisico: estoqueFisico,
    estoque_reservado: estoqueReservado
  }
}

/**
 * Remove das tabelas o que nao foi atualizado neste ciclo. Só roda quando a
 * varredura do catalogo terminou completa; se a paginação parou no meio, uma
 * limpeza poderia apagar produto bom que ficou de fora.
 */
async function removerInvalidosWake(
  inicio: Date | null,
  completa: boolean
): Promise<{ precos: number; estoque: number }> {
  if (!completa || !inicio) {
    console.warn(
      '[WAKE][PRODUTOS] Varredura incompleta; limpeza de inválidos ignorada'
    )
    return { precos: 0, estoque: 0 }
  }

  const precos = await removerPrecosNaoAtualizadosWake(inicio)
  const estoque = await removerEstoqueNaoAtualizadosWake(inicio)

  return { precos, estoque }
}

export async function sincronizarProdutosWake(): Promise<void> {
  console.log('[WAKE][PRODUTOS] Iniciando sincronização de preços e estoque')

  // Uma varredura so: o `camposAdicionais=Estoque` ja traz o estoque junto.
  const { produtos, completa } = await buscarProdutosWake()

  if (!produtos.length) {
    console.warn('[WAKE][PRODUTOS] Nenhum produto encontrado')
    await notifyGoogleChatWarning(
      'Nenhum produto encontrado na Wake para monitorar preço e estoque.'
    )
    return
  }

  const precos: WakePriceBody[] = []
  const estoques: WakeStockBody[] = []
  let ignoradosInvalidos = 0
  let ignoradosSemChave = 0
  let ignoradosSemIdNerus = 0

  for (const produto of produtos) {
    // Só `valido` por enquanto; `exibirSite` fica de fora desta regra.
    if (produto.valido === false) {
      ignoradosInvalidos++
      continue
    }

    const produtoVarianteId = paraInteiroOuNulo(produto.produtoVarianteId)

    if (produtoVarianteId === null || produtoVarianteId <= 0) {
      ignoradosSemChave++
      continue
    }

    // `idVinculoExterno` e o `prdno` do Nérus. Sem ele a linha nao cruza com
    // a base do cliente, entao e descartada como problema de integracao.
    const idVinculoExterno = textoOuNulo(produto.idVinculoExterno)

    if (!idVinculoExterno) {
      ignoradosSemIdNerus++
      continue
    }

    precos.push(paraPrecoBody(produto, produtoVarianteId, idVinculoExterno))
    estoques.push(
      paraEstoqueBody(produto, produtoVarianteId, idVinculoExterno)
    )
  }

  const ignorados = produtos.length - precos.length
  const inicio = completa ? await agoraMonitoramento() : null

  if (!precos.length) {
    console.warn('[WAKE][PRODUTOS] Nenhum produto válido para salvar', {
      produtos: produtos.length,
      ignoradosInvalidos,
      ignoradosSemChave,
      ignoradosSemIdNerus,
      completa
    })

    const removidos = await removerInvalidosWake(inicio, completa)
    const complementoLimpeza = completa
      ? `\nRemovidos: ${removidos.precos} (preços), ${removidos.estoque} (estoque)`
      : '\nLimpeza não executada: varredura incompleta.'

    await notifyGoogleChatWarning(
      `Nenhum produto válido encontrado na Wake para monitorar preço e estoque.\n` +
        `Produtos: ${produtos.length}\n` +
        `Inválidos: ${ignoradosInvalidos}\n` +
        `Sem chave: ${ignoradosSemChave}\n` +
        `Sem ID Nérus: ${ignoradosSemIdNerus}` +
        complementoLimpeza
    )
    return
  }

  const linhasAfetadasPrecos = await salvarPrecosWake(precos)
  const linhasAfetadasEstoque = await salvarEstoqueWake(estoques)
  const removidos = await removerInvalidosWake(inicio, completa)

  console.log('[WAKE][PRODUTOS] Preços e estoque sincronizados', {
    produtos: produtos.length,
    ignorados,
    ignoradosInvalidos,
    ignoradosSemChave,
    ignoradosSemIdNerus,
    precos: precos.length,
    estoque: estoques.length,
    linhasAfetadasPrecos,
    linhasAfetadasEstoque,
    removidosPrecos: removidos.precos,
    removidosEstoque: removidos.estoque,
    completa
  })

  const complementoLimpeza = completa
    ? `\nRemovidos: ${removidos.precos} (preços), ${removidos.estoque} (estoque)`
    : '\nLimpeza não executada: varredura incompleta.'

  await notifyGoogleChat(
    `Preços e estoque sincronizados na Wake.\n` +
      `Produtos: ${produtos.length}\n` +
      `Preços: ${precos.length} (ignorados: ${ignorados})\n` +
      `Estoque: ${estoques.length}\n` +
      `Inválidos: ${ignoradosInvalidos}; sem chave: ${ignoradosSemChave}; sem ID Nérus: ${ignoradosSemIdNerus}\n` +
      `Linhas afetadas: ${linhasAfetadasPrecos} (preços), ${linhasAfetadasEstoque} (estoque)` +
      complementoLimpeza
  )
}
