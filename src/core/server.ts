import dotenv from 'dotenv'
dotenv.config() // 🚨 PRIMEIRA LINHA EXECUTÁVEL

import Fastify from 'fastify'
import { loadIntegrations } from './loader'
import { integrationsController } from './integrations.controller'
import { validateCoreEnv } from './env.schema'
import { registerCrons } from './cron'

async function bootstrap() {
  // ✅ valida UMA VEZ
  const coreConfig = validateCoreEnv()

  const app = Fastify({ logger: true })

  app.get('/health', async () => ({ status: 'ok' }))
  app.get('/integrations', integrationsController)

  await loadIntegrations(app, coreConfig)
  registerCrons(coreConfig)

  await app.listen({
    port: coreConfig.PORT,
    host: '0.0.0.0'
  })
}

bootstrap().catch((err) => {
  console.error('[BOOTSTRAP ERROR]', err)
  process.exit(1)
})
