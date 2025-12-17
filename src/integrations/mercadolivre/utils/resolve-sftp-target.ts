import { format } from 'date-fns'
import path from 'path'
import { mercadolivreConfig } from '../env.schema'

export function resolveSftpTargetDir(
  baseDir: string,
  referenceDate: Date
): string {
  if (!mercadolivreConfig.MERCADOLIVRE_SFTP_ORGANIZE_BY_DATE) {
    return baseDir
  }

  const folder = format(referenceDate, 'yyyyMMdd')
  return path.join(baseDir, folder)
}
