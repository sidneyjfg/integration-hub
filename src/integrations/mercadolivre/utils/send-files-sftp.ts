import sendFileViaSFTP from "./send-file-sftp";

export async function sendFilesViaSFTP(
  files: string[],
  remoteDir: string
): Promise<void> {
  for (const file of files) {
    await sendFileViaSFTP(file, remoteDir)
  }
}