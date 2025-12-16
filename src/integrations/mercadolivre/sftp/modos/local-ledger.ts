import path from 'path'
import { mercadolivreConfig } from '../../env.schema'
import { filtrarPorIgnoreEndFile, filtrarPorTipoNota, moveFilesLocal } from '../../utils'

import { ledgerSimples } from '../ledger-simples'

export async function executarLocalLedger(
    files: string[]
): Promise<void> {

    const {
        MERCADOLIVRE_SFTP_DIR,
        MERCADOLIVRE_SFTP_IGNORE_END_FILE,
        MERCADOLIVRE_SFTP_IGNORE_TIPO_NOTA
    } = mercadolivreConfig

    let filtrados = filtrarPorIgnoreEndFile(
        files,
        MERCADOLIVRE_SFTP_IGNORE_END_FILE
    )

    filtrados = await filtrarPorTipoNota(
        filtrados,
        MERCADOLIVRE_SFTP_IGNORE_TIPO_NOTA
    )

    const novos = filtrados.filter(
        f => !ledgerSimples.jaEnviado(path.basename(f))
    )

    if (!novos.length) return

    await moveFilesLocal(novos, MERCADOLIVRE_SFTP_DIR)

    ledgerSimples.registrar(novos.map(f => path.basename(f)))
}
