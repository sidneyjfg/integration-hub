import { poolMonitoramento } from '../../core/db'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { TrayCorpProductBody } from '../../shared/types'

export default async function (app: FastifyInstance) {
  app.post(
    '/', 
async (req: FastifyRequest<{ Body: TrayCorpProductBody }>) => {
      const p = req.body as any

      await poolMonitoramento.execute(
        `
      INSERT INTO temp_products (
        produtoVarianteId,
        produtoId,
        idPaiExterno,
        sku,
        nome,
        nomeProdutoPai,
        precoCusto,
        precoDe,
        precoPor,
        ean,
        centroDistribuicaoId,
        estoqueFisico,
        estoqueReservado,
        alertaEstoque,
        dataCriacao,
        dataAtualizacao,
        parentId,
        raw_payload
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `,
        [
          p.produtoVarianteId,
          p.produtoId,
          p.idPaiExterno,
          p.sku,
          p.nome,
          p.nomeProdutoPai,
          p.precoCusto,
          p.precoDe,
          p.precoPor,
          p.ean,
          p.centroDistribuicaoId,
          p.estoqueFisico,
          p.estoqueReservado,
          p.alertaEstoque,
          p.dataCriacao,
          p.dataAtualizacao,
          p.parentId,
          JSON.stringify(p)
        ]
      )

      return { status: 'ok' }
    })
}
