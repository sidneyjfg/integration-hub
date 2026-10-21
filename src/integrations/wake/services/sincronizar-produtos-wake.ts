// src/integrations/wake/services/sincronizar-produtos-wake.ts
import { buscarProdutosWake } from '../api/wake-client'
import { salvarPrecosWake } from '../repositories/precos.repository'
import { salvarEstoqueWake } from '../repositories/estoque.repository'
import {
  notifyGoogleChat,
  notifyGoogleChatWarning
} from '../notifications/google-chat'
import { paraNumeroOuNulo } from '../utils'
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

/**
 * O catalogo nao tem produto sem variante; quando o id vem invalido, a linha
 * nao tem chave e e descartada. `valido` ausente conta como valido para nao
 * esconder produto do monitoramento por omissao da API.
 */
function paraPrecoBody(produto: WakeProductApi): WakePriceBody | null {
  const produtoVarianteId = paraInteiroOuNulo(produto.produtoVarianteId)

  if (produtoVarianteId === null || produtoVarianteId <= 0) {
    return null
  }

  return {
    produto_variante_id: produtoVarianteId,
    produto_id: paraInteiroOuNulo(produto.produtoId),
    id_pai_externo: textoOuNulo(produto.idPaiExterno),
    sku: textoOuNulo(produto.sku) ?? '',
    nome: textoOuNulo(produto.nome),
    preco_custo: paraNumeroOuNulo(produto.precoCusto),
    preco_de: paraNumeroOuNulo(produto.precoDe),
    preco_por: paraNumeroOuNulo(produto.precoPor),
    fator_multiplicador_preco: paraNumeroOuNulo(
      produto.fatorMultiplicadorPreco
    ),
    valido: produto.valido === false ? 0 : 1
  }
}

/**
 * A API devolve o estoque por centro de distribuicao; a linha do monitoramento
 * e por variante, com a soma dos centros. Array vazio e estoque zero; array
 * ausente e desconhecido (null) e nao vira zero.
 */
function paraEstoqueBody(produto: WakeProductApi): WakeStockBody | null {
  const produtoVarianteId = paraInteiroOuNulo(produto.produtoVarianteId)

  if (produtoVarianteId === null || produtoVarianteId <= 0) {
    return null
  }

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
    sku: textoOuNulo(produto.sku) ?? '',
    nome: textoOuNulo(produto.nome),
    estoque_fisico: estoqueFisico,
    estoque_reservado: estoqueReservado
  }
}

export async function sincronizarProdutosWake(): Promise<void> {
  console.log('[WAKE][PRODUTOS] Iniciando sincronização de preços e estoque')

  // Uma varredura so: o `camposAdicionais=Estoque` ja traz o estoque junto.
  const produtos = await buscarProdutosWake()

  if (!produtos.length) {
    console.warn('[WAKE][PRODUTOS] Nenhum produto encontrado')
    await notifyGoogleChatWarning(
      'Nenhum produto encontrado na Wake para monitorar preço e estoque.'
    )
    return
  }

  const precos: WakePriceBody[] = []
  const estoques: WakeStockBody[] = []

  for (const produto of produtos) {
    const preco = paraPrecoBody(produto)
    const estoque = paraEstoqueBody(produto)

    if (preco) precos.push(preco)
    if (estoque) estoques.push(estoque)
  }

  const ignorados = produtos.length - precos.length

  if (!precos.length || !estoques.length) {
    console.warn('[WAKE][PRODUTOS] Nenhum produto válido para salvar', {
      precos: precos.length,
      estoque: estoques.length
    })
    await notifyGoogleChatWarning(
      'Nenhum produto válido encontrado na Wake para monitorar preço e estoque.'
    )
    return
  }

  const linhasAfetadasPrecos = await salvarPrecosWake(precos)
  const linhasAfetadasEstoque = await salvarEstoqueWake(estoques)

  console.log('[WAKE][PRODUTOS] Preços e estoque sincronizados', {
    produtos: produtos.length,
    ignorados,
    precos: precos.length,
    estoque: estoques.length,
    linhasAfetadasPrecos,
    linhasAfetadasEstoque
  })

  await notifyGoogleChat(
    `Preços e estoque sincronizados na Wake.\n` +
      `Produtos: ${produtos.length}\n` +
      `Preços: ${precos.length} (ignorados: ${ignorados})\n` +
      `Estoque: ${estoques.length}\n` +
      `Linhas afetadas: ${linhasAfetadasPrecos} (preços), ${linhasAfetadasEstoque} (estoque)`
  )
}
