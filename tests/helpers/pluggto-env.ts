export function applyPluggtoTestEnv(
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
    ACTIVE_INTEGRATIONS: 'pluggto',
    STORENOS: '1,2',
    GOOGLE_CHAT_WEBHOOK_URL:
      process.env.GOOGLE_CHAT_WEBHOOK_URL || 'https://chat.googleapis.com/v1/spaces/AAAAOcR9s3A/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=iOjOShUIsciQQ0idXInA4UD-C9fz6qXTpfdnRlHIpt0',
    PLUGGTO_URL: 'https://api.plugg.to',
    PLUGGTO_CLIENT_ID: '5998dbbd87a669f7a2b05c93faeb1143',
    PLUGGTO_CLIENT_SECRET: '41760757df26d70a2523dad684d1177c',
    PLUGGTO_USERNAME: '1648816889894',
    PLUGGTO_PASSWORD: 'bWVidWtpMDEucGx1Z2d0b0BuZXJ1cy5jb20uYnIwLjAwNzgzODU0NjgyNzgzNjEzNTE2NDg4MTY4ODk4OTQ=',
    PLUGGTO_DAYS_TO_FETCH: '1',
    PLUGGTO_NO_LOOK_STATUS_TYPES: '',
    NERUS_RECEIVE_ORDER_URL: '',
    DAYS_TO_FETCH: '1',
    ...overrides
  })
}
