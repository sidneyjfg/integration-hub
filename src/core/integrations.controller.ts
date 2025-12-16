export async function integrationsController() {
  return {
    active: process.env.ACTIVE_INTEGRATIONS?.split(',') ?? []
  }
}
