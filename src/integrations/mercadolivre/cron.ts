import { sincronizarNotasMercadoLivre } from './services/sincronizar-notas-mercadolivre'
import { sincronizarSFTPMercadoLivre } from './services/sincronizar-sftp-mercadolivre'

export async function executarCronNotas() {
  await sincronizarNotasMercadoLivre()
}

export async function executarCronSFTP(){
  await sincronizarSFTPMercadoLivre()
}

