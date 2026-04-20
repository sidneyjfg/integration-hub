import path from 'node:path'

type TestCase = {
  name: string
  file: string
}

const tests: TestCase[] = [
  {
    name: 'unit: build-notas-notification',
    file: path.resolve(__dirname, 'mercadolivre/build-notas-notification.test.ts')
  },
  {
    name: 'integration: buscar-notas meli',
    file: path.resolve(__dirname, 'mercadolivre/buscar-notas.integration.test.ts')
  },
  {
    name: 'integration: salvar-notas monitoramento',
    file: path.resolve(__dirname, 'mercadolivre/salvar-notas.integration.test.ts')
  },
  {
    name: 'integration: sincronizar-notas',
    file: path.resolve(__dirname, 'mercadolivre/sincronizar-notas.integration.test.ts')
  }
]

async function main(): Promise<void> {
  let failures = 0

  for (const testCase of tests) {
    try {
      const run = require(testCase.file) as () => Promise<void>
      await run()
      console.log(`PASS ${testCase.name}`)
    } catch (error) {
      failures++
      console.error(`FAIL ${testCase.name}`)
      console.error(error)
    }
  }

  if (failures > 0) {
    process.exitCode = 1
    throw new Error(`${failures} teste(s) falharam.`)
  }

  console.log(`PASS ${tests.length} teste(s) executados com sucesso.`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
