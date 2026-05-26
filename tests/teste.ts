import fs from 'fs/promises'
import path from 'path'
import { parseStringPromise } from 'xml2js'

function normalize(str: string) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

async function detectarTipoNota(xmlPath: string) {
  try {
    const xml = await fs.readFile(xmlPath, 'utf8')
    const parsed = await parseStringPromise(xml)

    const natOp =
      parsed?.nfeProc?.NFe?.[0]?.infNFe?.[0]?.ide?.[0]?.natOp?.[0] ||
      parsed?.NFe?.infNFe?.[0]?.ide?.[0]?.natOp?.[0]

    if (!natOp) {
      return {
        arquivo: path.basename(xmlPath),
        tipo: '❓ NATOP NÃO ENCONTRADO'
      }
    }

    return {
      arquivo: path.basename(xmlPath),
      tipo: normalize(String(natOp))
    }
  } catch (err: any) {
    return {
      arquivo: path.basename(xmlPath),
      tipo: `❌ ERRO AO LER XML (${err.message})`
    }
  }
}

async function run() {
  const xmlDir = path.resolve('./')

  console.log('📂 Diretório analisado:', xmlDir)

  const files = (await fs.readdir(xmlDir))
    .filter(f => f.endsWith('.xml'))
    .map(f => path.join(xmlDir, f))

  if (!files.length) {
    console.log('⚠ Nenhum XML encontrado')
    return
  }

  console.log('\n🔍 Analisando tipo das notas (natOp):\n')

  for (const file of files) {
    const result = await detectarTipoNota(file)
    console.log(`📄 ${result.arquivo}`)
    console.log(`   ➜ TIPO: ${result.tipo}\n`)
  }

  console.log('✅ Teste finalizado')
}

run().catch(err => {
  console.error('❌ Erro geral no teste', err)
  process.exit(1)
})
