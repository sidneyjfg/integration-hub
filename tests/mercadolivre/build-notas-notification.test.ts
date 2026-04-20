import assert from 'node:assert/strict'
import path from 'node:path'

type BuildNotificationModule = typeof import('../../src/integrations/mercadolivre/notifications/build-notas-notification')

const modulePath = path.resolve(
  __dirname,
  '../../src/integrations/mercadolivre/notifications/build-notas-notification.ts'
)

export = async function runBuildNotasNotificationTest(): Promise<void> {
  const { buildNotasNaoIntegradasCard } = require(modulePath) as BuildNotificationModule

  const payload = buildNotasNaoIntegradasCard(
    [
      {
        NFE: '1001',
        SERIE: '1',
        EMISSAO: '20260410'
      },
      {
        NFE: '1002',
        SERIE: '2',
        EMISSAO: '20260411'
      }
    ],
    'MLB-123'
  )

  assert.equal(payload.cardsV2.length, 1)
  assert.equal(payload.cardsV2[0].cardId, 'notas-nao-integradas')
  assert.equal(payload.cardsV2[0].card.header.subtitle, 'Mercado Livre • Conta MLB-123')
  assert.equal(payload.cardsV2[0].card.sections[0].widgets.length, 2)
  assert.equal(
    payload.cardsV2[0].card.sections[0].widgets[0].decoratedText.text,
    '<b>1001 / 1</b>'
  )
  assert.match(
    payload.cardsV2[0].card.sections[0].widgets[0].decoratedText.bottomLabel,
    /10\/04\/2026/
  )
  assert.equal(
    payload.cardsV2[0].card.sections[0].widgets[1].decoratedText.text,
    '<b>1002 / 2</b>'
  )
  assert.match(
    payload.cardsV2[0].card.sections[0].widgets[1].decoratedText.bottomLabel,
    /11\/04\/2026/
  )
}
