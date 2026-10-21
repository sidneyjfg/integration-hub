-- Tabela de monitoramento de preco da Wake (Fbits).
-- Tabela propria por hub: nao usa `temp_products` para nao colidir com
-- anymarket, pluggto e traycorp, que gravam o mesmo nome no mesmo schema.
-- A chave e a variante; o ERP cruza pelo `sku` e filtra `valido` no SQL.
CREATE TABLE IF NOT EXISTS temp_wake_price (
  produto_variante_id BIGINT(20) NOT NULL,
  produto_id BIGINT(20) DEFAULT NULL,
  id_pai_externo VARCHAR(255) DEFAULT NULL,
  sku VARCHAR(255) NOT NULL DEFAULT '',
  nome VARCHAR(500) DEFAULT NULL,
  preco_custo DECIMAL(15,2) DEFAULT NULL,
  preco_de DECIMAL(15,2) DEFAULT NULL,
  preco_por DECIMAL(15,2) DEFAULT NULL,
  fator_multiplicador_preco DECIMAL(15,4) DEFAULT NULL,
  valido TINYINT(1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (produto_variante_id),
  KEY idx_sku (sku)
) ENGINE=InnoDB;
