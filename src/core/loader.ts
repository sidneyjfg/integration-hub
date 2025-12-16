import type { FastifyInstance } from 'fastify'
import type { CoreEnv } from './env.schema'
import { runHubMigrations } from './migrations'

export async function loadIntegrations(
  app: FastifyInstance,
  coreConfig: CoreEnv
) {
  const active = coreConfig.ACTIVE_INTEGRATIONS
    .split(',')
    .map(i => i.trim())

  for (const hub of active) {
    await runHubMigrations(hub)

    // 👇 require dinâmico (funciona em ts-node + Node16)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const integration = require(`../integrations/${hub}`)

    await integration.register(app)

    app.log.info(`[hub] ${hub} pronto`)
  }
}
