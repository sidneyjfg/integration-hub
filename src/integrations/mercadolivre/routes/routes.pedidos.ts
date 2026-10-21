import { FastifyPluginAsync } from 'fastify'
import { listarPedidosMonitorados } from '../repositories/pedidos.repository'

const routes: FastifyPluginAsync = async app => {
  app.get('/resumo', async (request, reply) => {
    const query = request.query as { limite?: string }
    const limite = query.limite == null ? 100 : Number(query.limite)
    if (!Number.isInteger(limite) || limite < 1 || limite > 500) {
      return reply.code(400).send({ erro: 'limite deve ser um inteiro entre 1 e 500' })
    }
    return { pedidos: await listarPedidosMonitorados(limite) }
  })
}

export default routes
