export function getNotasWorkspace(sftpMode: boolean) {
  const baseDir = sftpMode ? "./notas/sftp" : "./notas/normal";

  return {
    baseDir,
    xmlDir: `${baseDir}/xml`,
  };
}
