import { moveFilesLocal, sendFilesViaSFTP } from "../utils"


export async function processarPadrao(
    files: string[],
    usarSftp: boolean
) {
    if (usarSftp) {
        await sendFilesViaSFTP(files, process.env.DIR_SFTP!)
    } else {
        await moveFilesLocal(files, process.env.DIR_SFTP!)
    }
}
