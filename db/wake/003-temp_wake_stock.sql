-- Tabela de monitoramento de estoque da Wake (Fbits).
-- Tabela propria por hub: nao usa `temp_products` para nao colidir com
-- anymarket, pluggto e traycorp, que gravam o mesmo nome no mesmo schema.
-- A API devolve o estoque por centro de distribuicao no `estoque[]`; aqui a
-- linha e por variante, com a soma dos centros, para o ERP cruzar pelo `sku`.
CREATE TABLE IF NOT EXISTS temp_wake_stock (
  produto_variante_id BIGINT(20) NOT NULL,
  sku VARCHAR(255) NOT NULL DEFAULT '',
  nome VARCHAR(500) DEFAULT NULL,
  estoque_fisico INT(11) DEFAULT NULL,
  estoque_reservado INT(11) DEFAULT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (produto_variante_id),
  KEY idx_sku (sku)
) ENGINE=InnoDB;
