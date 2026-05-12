import { sincronizarNotasMercadoLivre } from './services/sincronizar-notas-mercadolivre'
import { sincronizarSFTPMercadoLivre } from './services/sincronizar-sftp-mercadolivre'
import { sincronizarEtiquetaMercadoLivre } from './services/sincronizar-etiqueta-mercadolivre'

export async function executarCronNotas() {
  await sincronizarNotasMercadoLivre()
}

export async function executarCronSFTP(){
  await sincronizarSFTPMercadoLivre()
}

export async function executarCronEtiqueta() {
  await sincronizarEtiquetaMercadoLivre()
}
