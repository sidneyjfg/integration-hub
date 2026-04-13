import { poolMonitoramento, poolMain } from '../../../core/db'
import { coreConfig } from '../../../core/env.schema'
import { mercadolivreConfig } from '../env.schema'
import { MercadoLivreNotaBody } from '../../../shared/types/mercadolivre'
import { isSerieIgnorada } from '../utils'

export type MercadoLivreCredential = {
  clienteId: string            // user_id
  clientId: string             // Mercado Livre OAuth client_id real
  clientSecret: string
  accessToken: string
  refreshToken: string
}

/**
 * 🔍 Verifica se a nota já existe no Nérus (nfeavxml)
 */
export async function checkNotaExistente(
  chaveNfe: string
): Promise<boolean> {
  const storenos = coreConfig.STORENOS
    .split(',')
    .map(s => `'${s.trim()}'`)
    .join(',')

  const sql = `
      SELECT 1
        FROM ${coreConfig.DB_NAME_DADOS}.nfeavxml
      WHERE nfkey = ?
        AND storeno IN (${storenos})
      LIMIT 1
    `

  const [rows] = await poolMain.query(sql, [chaveNfe])
  return (rows as any[]).length > 0
}

/**
 * 🔍 Verifica se a nota já existe na tabela temporária tmp_notas
 */
async function checkNotaTemporariaExistente(
  chaveNfe: string
): Promise<boolean> {
  const sql = `
      SELECT 1
        FROM ${coreConfig.DB_NAME_MONITORAMENTO}.tmp_notas
      WHERE chave = ?
      LIMIT 1
    `
  const [rows] = await poolMonitoramento.query(sql, [chaveNfe])
  return (rows as any[]).length > 0
}

/**
 * 💾 Insere notas na tabela tmp_notas (idempotente)
 */
export async function salvarNotasTmpMercadoLivre(
  notas: MercadoLivreNotaBody[]
): Promise<MercadoLivreNotaBody[]> {

  const inseridas: MercadoLivreNotaBody[] = []

  let ignoradasSerie = 0
  let ignoradasTipo = 0
  let jaExistiam = 0
  let inseridasNovas = 0
  let erros = 0

  if (notas.length === 0) {
    console.log('[MERCADOLIVRE][DB] Nenhuma nota para salvar.')
    return inseridas
  }

  const sql = `
      INSERT INTO ${coreConfig.DB_NAME_MONITORAMENTO}.tmp_notas
        (status, venda_remesa, NFe, serie, nome, chave,
        modalidade, operacao, tipo_logistico,
        emissao, valor, valor_total, frete,
        observacao, data_nfe_ref, chave_nfe_ref)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
status =
CASE
  WHEN VALUES(status) = 'Cancelada' THEN 'Cancelada'
  WHEN VALUES(status) = 'Inutilizada' THEN 'Inutilizada'
  ELSE status
END,
  venda_remesa = COALESCE(VALUES(venda_remesa), venda_remesa),
  NFe = COALESCE(VALUES(NFe), NFe),
  serie = COALESCE(VALUES(serie), serie),
  nome = COALESCE(VALUES(nome), nome),
  modalidade = COALESCE(VALUES(modalidade), modalidade),
  operacao = COALESCE(VALUES(operacao), operacao),
  tipo_logistico = COALESCE(VALUES(tipo_logistico), tipo_logistico),
  emissao = COALESCE(VALUES(emissao), emissao),
  valor = COALESCE(VALUES(valor), valor),
  valor_total = COALESCE(VALUES(valor_total), valor_total),
  frete = COALESCE(VALUES(frete), frete),
  observacao = COALESCE(VALUES(observacao), observacao),
  data_nfe_ref = COALESCE(VALUES(data_nfe_ref), data_nfe_ref),
  chave_nfe_ref = COALESCE(VALUES(chave_nfe_ref), chave_nfe_ref)
    `
  let atualizadas = 0
  for (const nota of notas) {
    try {

      if (await isSerieIgnorada(nota.serie)) {
        ignoradasSerie++
        continue
      }

      if (nota.tipo_logistico === 'Cross Docking') {
        ignoradasTipo++
        continue
      }

      const [res] = await poolMonitoramento.execute(sql, [
        nota.status ?? null,
        nota.venda_remessa ?? null,
        nota.NFe ?? null,
        nota.serie ?? null,
        nota.nome ?? null,
        nota.chave,
        nota.modalidade ?? null,
        nota.operacao ?? null,
        nota.tipo_logistico ?? null,
        nota.emissao ?? null,
        nota.valor ?? null,
        nota.valor_total ?? null,
        nota.frete ?? null,
        nota.observacao ?? null,
        nota.data_nfe_ref ?? null,
        nota.chave_nfe_ref ?? null
      ])

      const result = res as any

      if (result.affectedRows === 1) {
        inseridasNovas++
        console.log('[MERCADOLIVRE][DB] Inserida nova nota', nota.chave)
      }

      if (result.affectedRows === 2) {
        atualizadas++
        console.log('[MERCADOLIVRE][DB] Nota atualizada', nota.chave)
      }

      inseridas.push(nota)

    } catch (err) {
      erros++
      console.error('[MERCADOLIVRE][DB] Erro ao inserir nota', {
        chave: nota.chave,
        err
      })
    }
  }

  // 📊 RESUMO FINAL (ESSENCIAL!)
  console.log('[MERCADOLIVRE][DB][RESUMO]', {
    totalRecebidas: notas.length,
    inseridasNovas,
    atualizadas,
    ignoradasSerie,
    ignoradasTipo,
    erros
  })


  return inseridas
}


/**
 * 🧱 Cria a tabela tmp_notas se não existir
 */
export async function verificarECriarTabelaTmpNotas(): Promise<void> {
  const sql = `
      CREATE TABLE IF NOT EXISTS ${coreConfig.DB_NAME_MONITORAMENTO}.tmp_notas (
        status varchar(100) DEFAULT NULL,
        venda_remesa varchar(100) DEFAULT NULL,
        NFe varchar(100) DEFAULT NULL,
        serie varchar(100) DEFAULT NULL,
        nome varchar(100) DEFAULT NULL,
        chave varchar(100) NOT NULL,
        modalidade varchar(100) DEFAULT NULL,
        operacao varchar(100) DEFAULT NULL,
        tipo_logistico varchar(100) DEFAULT NULL,
        emissao varchar(100) DEFAULT NULL,
        valor varchar(100) DEFAULT NULL,
        valor_total varchar(100) DEFAULT NULL,
        frete varchar(100) DEFAULT NULL,
        observacao varchar(100) DEFAULT NULL,
        data_nfe_ref varchar(100) DEFAULT NULL,
        chave_nfe_ref varchar(100) DEFAULT NULL,
        PRIMARY KEY (chave),
        KEY i2 (NFe, serie),
        KEY i3 (chave_nfe_ref),
        KEY i4 (status)
      ) ENGINE=MyISAM DEFAULT CHARSET=latin1
    `

  await poolMonitoramento.execute(sql)
  console.log('[MERCADOLIVRE][DB] tmp_notas verificada/criada')
}

/**
 * 🔍 Busca notas do Mercado Livre que ainda NÃO foram integradas no Nérus
 * (comparação tmp_notas x nfeavxml)
 */
// export async function buscarNotasNaoIntegradasNerus(): Promise<any[]> {
//   const sql = `
//     SELECT
//       t.chave                 AS CHAVE_NFE,
//       t.NFe                   AS NFE,
//       t.serie                 AS SERIE,
//       t.emissao               AS EMISSAO,
//       t.valor_total           AS VALOR_TOTAL,
//       t.tipo_logistico        AS TIPO_LOGISTICO,
//       t.status                AS STATUS,
//       t.modalidade            AS MODALIDADE
//     FROM ${coreConfig.DB_NAME_MONITORAMENTO}.tmp_notas t
//     WHERE NOT EXISTS (
//       SELECT 1
//         FROM ${coreConfig.DB_NAME_DADOS}.nfeavxml n
//        WHERE n.nfkey = t.chave and n.storeno in(${coreConfig.STORENOS.split(',').map(id => `'${id.trim()}'`).join(', ')})
//     ) 
//     ORDER BY t.emissao DESC
//   `

//   const [rows] = await poolMonitoramento.query(sql)

//   const resultado = rows as any[]

//   console.log(
//     '[MERCADOLIVRE][DB] Notas não integradas encontradas',
//     { total: resultado.length }
//   )

//   return resultado
// }


/**
 * 🧾 Busca o log mais recente da nota não integrada
 */
export async function buscarLogNotaNaoIntegrada(
  chaveNfe: string
): Promise<{ remarks?: string; log?: string; storeno?: string } | null> {
  const sql = `
      SELECT remarks, log, storeno
        FROM ${coreConfig.DB_NAME_DADOS}.lognerusff
      WHERE nfKey = ?
      ORDER BY seqnoAuto DESC
      LIMIT 1
    `

  const [rows] = await poolMain.query(sql, [chaveNfe])
  return (rows as any[])[0] ?? null
}

/**
 * 🔍 Busca notas específicas que ainda NÃO foram integradas no Nérus
 * (filtrando por lista de chaves — uso por cliente)
 */
export async function buscarNotasNaoIntegradasNerusPorChaves(
  chaves: string[]
): Promise<any[]> {

  if (!chaves.length) return []

  const placeholders = chaves.map(() => '?').join(', ')

  const sql = `
    SELECT
      t.chave AS CHAVE_NFE,
      t.NFe   AS NFE,
      t.serie AS SERIE,
      t.emissao AS EMISSAO,
      t.valor_total    AS VALOR_TOTAL,
      t.tipo_logistico AS TIPO_LOGISTICO,
      t.status         AS STATUS,
      t.modalidade     AS MODALIDADE
    FROM ${coreConfig.DB_NAME_MONITORAMENTO}.tmp_notas t
    WHERE t.chave IN (${placeholders})
      AND NOT EXISTS (
        SELECT 1
        FROM ${coreConfig.DB_NAME_DADOS}.nfeavxml n
        WHERE n.nfkey = t.chave
          AND n.storeno IN (${coreConfig.STORENOS
      .split(',')
      .map(id => `'${id.trim()}'`)
      .join(', ')})
      )
    ORDER BY
      t.emissao DESC
  `

  const [rows] = await poolMonitoramento.query(sql, chaves)

  console.log('[MERCADOLIVRE][DB] Notas não integradas (por chaves)', {
    total: (rows as any[]).length
  })

  return rows as any[]
}

/**
 * 🔁 Lê o retryCount atual da ffpreprocnf
 */
export async function getRetryCountFfpreprocnf(params: {
  nfno: string
  nfse: string
  storeno: number
}): Promise<number | null> {
  const sql = `
      SELECT MAX(retryCount) AS retryCount
        FROM ${coreConfig.DB_NAME_DADOS}.ffpreprocnf
      WHERE nfno = ?
        AND nfse = ?
        AND storeno = ?
    `

  const [rows] = await poolMain.query(sql, [
    params.nfno,
    params.nfse,
    params.storeno
  ])

  const value = (rows as any[])[0]?.retryCount
  return value != null ? Number(value) : null
}

/**
 * 🔁 Zera retryCount na ffpreprocnf
 */
export async function zerarRetryCountFfpreprocnf(params: {
  nfno: string
  nfse: string
  storeno: number
}): Promise<number> {
  const sql = `
      UPDATE ${coreConfig.DB_NAME_DADOS}.ffpreprocnf
        SET retryCount = 0
      WHERE nfno = ?
        AND nfse = ?
        AND storeno = ?
      LIMIT 1
    `

  const [res] = await poolMain.query(sql, [
    params.nfno,
    params.nfse,
    params.storeno
  ])

  return (res as any).affectedRows ?? 0
}

export async function buscarCredenciaisMercadoLivre(): Promise<MercadoLivreCredential[]> {
  const sql = `
      SELECT
        u.userId AS clienteId,
        u.clientSecret AS clientSecret,
        u.accessToken AS accessToken,
        u.refreshToken AS refreshToken,

        CASE u.clientSecret
          WHEN 'gcqTSgpZcUSeFuvS9EjM5EwO83DzZWwN' THEN '7728772652676163'
          WHEN '3WNCDQ6jJOJJfcGVpZtb4YyyVhewL4Ai' THEN '3190113795567312'
          ELSE NULL
        END AS clientId

      FROM ${coreConfig.DB_NAME_DADOS}.userfull u
      WHERE u.accessToken IS NOT NULL
        AND u.refreshToken IS NOT NULL
    `

  const [rows] = await poolMain.query(sql)

  return rows as MercadoLivreCredential[]
}