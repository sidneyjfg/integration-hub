import assert from 'node:assert/strict'
import path from 'node:path'
import { clearModules, requireWithMocks } from '../helpers/module-loader'

const raiz = path.resolve(__dirname, '../../src/integrations/mercadolivre')
const modulo = path.join(raiz, 'services/busca-cs-diaria.ts')

export = async function run(): Promise<void> {
  clearModules([modulo])
  const chamadas: string[] = []
  const gravados: any[] = []
  const historico = new Map([
    ['20261001', { dia: '20261001', totalNotas: 3, valorBruto: 10 }],
    ['20261003', { dia: '20261003', totalNotas: 99, valorBruto: 99 }],
  ])
  let falhar = false
  const servico = requireWithMocks<typeof import('../../src/integrations/mercadolivre/services/busca-cs-diaria')>(modulo, {
    [path.join(raiz, 'repositories/mercadolivre-notas.repository.ts')]: {
      buscarCredenciaisMercadoLivre: async () => [{ clienteId: 'conta-teste' }],
    },
    [path.join(raiz, 'repositories/busca-cs-diaria.repository.ts')]: {
      buscarApuracoesCS: async () => [...historico.values()],
      salvarApuracaoCS: async (_: string, valor: any) => {
        gravados.push(valor)
        historico.set(valor.dia, valor)
      },
    },
    [path.join(raiz, 'services/busca-cs-google-sheets.ts')]: {
      resolverPeriodoD1: () => ({ inicio: '20261001', fim: '20261004' }),
    },
    [path.join(raiz, 'api/buscar-pedidos-mercadolivre.ts')]: {
      buscarResumoDiarioValoresPedidosMercadoLivre: async (dia: string) => {
        chamadas.push(dia)
        return { valoresPorDia: { [dia]: 20 } }
      },
    },
    [path.join(raiz, 'api/buscar-notas-mercadolivre.ts')]: {
      contarNotasMercadoLivre: async ({ startDate }: any) => {
        if (falhar) throw new Error('API indisponível')
        return { notasPorDia: { [startDate]: 4 } }
      },
    },
  })
  const resultado = await servico.apurarBuscaCSDiaria('20261003')
  assert.deepEqual(chamadas, ['20261001', '20261002', '20261003'], 'Revalidar dias antigos e preencher dias faltantes')
  assert.deepEqual(resultado.valoresPorDia, { '20261001': 20, '20261002': 40, '20261003': 60 }, 'Corrigir todos os acumulados após alteração antiga')
  assert.deepEqual(resultado.notasPorDia, { '20261001': 4, '20261002': 4, '20261003': 4 })
  assert.equal(gravados.length, 3)
  chamadas.length = 0
  await servico.apurarBuscaCSDiaria('20261003')
  assert.deepEqual(chamadas, ['20261001', '20261002', '20261003'])
  assert.equal(gravados.length, 3, 'Revalidar sem gravar novamente totais iguais')
  chamadas.length = 0
  await servico.apurarBuscaCSDiaria('20261003', true)
  assert.deepEqual(chamadas, ['20261001', '20261002', '20261003'])
  falhar = true
  const antes = gravados.length
  await assert.rejects(servico.apurarBuscaCSDiaria('20261003'), /API indisponível/)
  assert.equal(gravados.length, antes, 'Falha não deve substituir os totais anteriores')
  clearModules([modulo])
}
