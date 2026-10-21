import type { FastifyInstance } from 'fastify'

export async function register(_app: FastifyInstance) {
  // Rotas HTTP entram em etapa posterior; por enquanto o hub so expoe crons.
}
