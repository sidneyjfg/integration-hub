export function applyWakeTestEnv(
  overrides: Record<string, string> = {}
): void {
  Object.assign(process.env, {
    PORT: '3000',
    DB_HOST_MONITORAMENTO: 'localhost',
    DB_PORT_MONITORAMENTO: '3306',
    DB_USER_MONITORAMENTO: 'root',
    DB_PASS_MONITORAMENTO: 'root',
    DB_NAME_DADOS: 'dados',
    DB_NAME_MONITORAMENTO: 'monitoramento',
    ACTIVE_INTEGRATIONS: 'wake',
    STORENOS: '1,2',
    GOOGLE_CHAT_WEBHOOK_URL: 'https://chat.googleapis.com/v1/spaces/fake/messages?key=fake',
    GOOGLE_CHAT_WEBHOOK_URL_WARNING: 'https://chat.googleapis.com/v1/spaces/fake/messages?key=fake',
    GOOGLE_CHAT_WEBHOOK_URL_ERROR: 'https://chat.googleapis.com/v1/spaces/fake/messages?key=fake',
    WAKE_URL: 'https://api.fbits.net',
    // valor ficticio: nenhum segredo real entra no repo
    WAKE_TOKEN: 'token-wake-de-teste',
    ...overrides
  })
}
