export function getActiveHubs(): string[] {
  return process.env.ACTIVE_INTEGRATIONS
    ?.split(',')
    .map(h => h.trim()) ?? []
}
