export function applyTraycommerceTestEnv(
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
    ACTIVE_INTEGRATIONS: 'traycommerce',
    STORENOS: '1,2',
    GOOGLE_CHAT_WEBHOOK_URL: 'https://chat.googleapis.com/v1/spaces/fake/messages?key=fake',
    GOOGLE_CHAT_WEBHOOK_URL_WARNING: 'https://chat.googleapis.com/v1/spaces/fake/messages?key=fake',
    GOOGLE_CHAT_WEBHOOK_URL_ERROR: 'https://chat.googleapis.com/v1/spaces/fake/messages?key=fake',
    TRAYCOMMERCE_URL: 'https://exemplo.commercesuite.com.br/web_api',
    // valores ficticios: nenhum segredo real entra no repo
    TRAYCOMMERCE_CONSUMER_KEY: 'consumer-key-de-teste',
    TRAYCOMMERCE_SECRET_KEY: 'secret-key-de-teste',
    TRAYCOMMERCE_CODE: 'code-de-teste',
    TRAYCOMMERCE_STORE_ID: '9999999',
    TRAYCOMMERCE_ORDER_STATUS_TO_GET: '1,14,49',
    ...overrides
  })
}
