export function applyMercadoLivreTestEnv(
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
    ACTIVE_INTEGRATIONS: 'mercadolivre',
    STORENOS: '1,2',
    GOOGLE_CHAT_WEBHOOK_URL:
      process.env.GOOGLE_CHAT_WEBHOOK_URL || 'https://chat.googleapis.com/v1/spaces/AAAAOcR9s3A/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=iOjOShUIsciQQ0idXInA4UD-C9fz6qXTpfdnRlHIpt0',
    CLIENT_NAME: 'Cliente Teste',
    MERCADOLIVRE_DAYS_TO_FETCH: '1',
    MERCADOLIVRE_END_TO_FETCH: '0',
    MERCADOLIVRE_END_SFTP: '0',
    MERCADOLIVRE_SFTP_ENABLED: 'false',
    MERCADOLIVRE_USE_LEDGER: 'false',
    MERCADOLIVRE_DISPONIBILIZA_XML_DIVERGENTE: 'false',
    MERCADOLIVRE_IGNORE_SERIE: '',
    ...overrides
  })
}
