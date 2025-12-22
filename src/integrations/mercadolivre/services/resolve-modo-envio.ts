import { mercadolivreConfig } from '../env.schema'

export type ModoEnvio =
  | 'LOCAL_SIMPLES'
  | 'LOCAL_LEDGER'
  | 'SFTP_SIMPLES'
  | 'SFTP_LEDGER'
  | 'SFTP_VONDER_LEDGER'

export function resolverModoEnvio(): ModoEnvio {
  const {
    MERCADOLIVRE_SFTP_ENABLED,
    MERCADOLIVRE_USE_LEDGER,
    MERCADOLIVRE_IS_VONDER
  } = mercadolivreConfig

  if (MERCADOLIVRE_IS_VONDER) {
    return 'SFTP_VONDER_LEDGER'
  }
  if (!MERCADOLIVRE_SFTP_ENABLED) {
    return MERCADOLIVRE_USE_LEDGER
      ? 'LOCAL_LEDGER'
      : 'LOCAL_SIMPLES'
  }



  return MERCADOLIVRE_USE_LEDGER
    ? 'SFTP_LEDGER'
    : 'SFTP_SIMPLES'
}
