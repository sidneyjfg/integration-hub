import { sendFilesViaSFTP, moveFilesLocal } from '../utils'
import { isCTe, isEventoNFe, isParaIN } from './classify/classificar-xml-vonder(FG)'

export async function processarVonder(
    files: string[],
    usarSftp: boolean
) {
    const ctes = files.filter(isCTe)
    const eventos = files.filter(isEventoNFe)
    const paraIN = files.filter(isParaIN)

    const remoteDir = process.env.DIR_SFTP!

    if (usarSftp) {
        await sendFilesViaSFTP(paraIN, `${remoteDir}/IN`)
        await sendFilesViaSFTP(eventos, `${remoteDir}/IN_EVENTOS`)
        await sendFilesViaSFTP(ctes, `${remoteDir}/CTE`)
    } else {
        await moveFilesLocal(paraIN, `${remoteDir}/IN`)
        await moveFilesLocal(eventos, `${remoteDir}/IN_EVENTOS`)
        await moveFilesLocal(ctes, `${remoteDir}/CTE`)
    }
}
