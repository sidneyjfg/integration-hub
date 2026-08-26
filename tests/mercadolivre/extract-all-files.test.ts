import assert from 'node:assert/strict'

import { filterIssuedXml } from '../../src/integrations/mercadolivre/utils/extractAllFiles'

export = async function runExtractAllFilesTest(): Promise<void> {
  const files = [
    'lote/emitidas_mercado_livre/xml/ml.xml',
    'lote/emitidas_outros_erp/xml/erp.xml',
    'lote/recebidas/xml/recebida.xml'
  ]

  assert.deepEqual(filterIssuedXml(files), [files[0]])
  assert.deepEqual(filterIssuedXml(files, false), [files[0]])
  assert.deepEqual(filterIssuedXml(files, true), [files[0], files[1]])

  assert.deepEqual(
    filterIssuedXml([files[1]], false),
    [],
    'A pasta de outros ERPs deve permanecer ignorada por padrao'
  )
}
