import { poolMonitoramento } from '../../core/db'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { MercadoLivreNotaBody } from '../../shared/types'

export default async function (app: FastifyInstance) {
  app.post(
    '/',
    async (req: FastifyRequest<{ Body: MercadoLivreNotaBody }>) => {
      const n = req.body

      await poolMonitoramento.execute(
        `
        INSERT IGNORE INTO tmp_notas (
          status,
          venda_remesa,
          NFe,
          serie,
          nome,
          chave,
          modalidade,
          operacao,
          tipo_logistico,
          emissao,
          valor,
          valor_total,
          frete,
          observacao,
          data_nfe_ref,
          chave_nfe_ref
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `,
        [
          n.status,
          n.venda_remesa,
          n.NFe,
          n.serie,
          n.nome,
          n.chave,
          n.modalidade,
          n.operacao,
          n.tipo_logistico,
          n.emissao,
          n.valor,
          n.valor_total,
          n.frete,
          n.observacao,
          n.data_nfe_ref,
          n.chave_nfe_ref
        ]
      )

      return { status: 'ok' }
    }
  )
}
