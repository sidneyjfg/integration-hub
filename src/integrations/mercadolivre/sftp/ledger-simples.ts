import fs from 'fs'
import path from 'path'

/**
 * 📒 Ledger simples
 * - Guarda apenas o nome do arquivo
 * - Evita reenvio / reprocessamento
 */
class LedgerSimples {
  private ledgerPath: string
  private cache: Set<string>

  constructor() {
    const baseDir = path.resolve(process.cwd(), '../ledger')
    
      this.ledgerPath = path.join(baseDir, 'mercadolivre-ledger.json')

    console.log('[LEDGER] Path:', this.ledgerPath)   // 👈 ADICIONE

    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true })
    }

    this.cache = new Set<string>()
    this.load()
  }

  // 🔄 Carrega ledger do disco
  private load(): void {
    if (!fs.existsSync(this.ledgerPath)) return

    try {
      const raw = fs.readFileSync(this.ledgerPath, 'utf8')
      const parsed: string[] = JSON.parse(raw)
      parsed.forEach(f => this.cache.add(f))
    } catch (err) {
      console.error('[LEDGER] Erro ao carregar ledger', err)
    }
  }

  // 💾 Persiste no disco
  private save(): void {
    try {
      fs.writeFileSync(
        this.ledgerPath,
        JSON.stringify([...this.cache].sort(), null, 2),
        'utf8'
      )
    } catch (err) {
      console.error('[LEDGER] Erro ao salvar ledger', err)
    }
  }

  // 🔍 Verifica se já foi enviado
  public jaEnviado(fileName: string): boolean {
    return this.cache.has(fileName)
  }

  // ➕ Registra arquivos enviados
  public registrar(fileNames: string[]): void {
    let alterado = false

    for (const name of fileNames) {
      if (!this.cache.has(name)) {
        this.cache.add(name)
        alterado = true
      }
    }

    if (alterado) {
      this.save()
    }
  }

  // 🧹 (opcional) Limpa ledger inteiro
  public limpar(): void {
    this.cache.clear()
    this.save()
  }
}

// 🔁 Singleton compartilhado
export const ledgerSimples = new LedgerSimples()
