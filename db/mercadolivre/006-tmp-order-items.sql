CREATE TABLE IF NOT EXISTS tmp_order_items (
  origem VARCHAR(40) NOT NULL,
  cliente_id VARCHAR(32) NOT NULL,
  pedido_id VARCHAR(32) NOT NULL,
  item_id VARCHAR(32) NOT NULL,
  indice SMALLINT UNSIGNED NOT NULL,
  titulo VARCHAR(255) DEFAULT NULL,
  variacao_id VARCHAR(32) DEFAULT NULL,
  quantidade DECIMAL(18,4) DEFAULT NULL,
  preco_unitario DECIMAL(18,2) DEFAULT NULL,
  total_item DECIMAL(18,2) DEFAULT NULL,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (origem, cliente_id, pedido_id, indice),
  KEY idx_tmp_order_items_anuncio (item_id),
  KEY idx_tmp_order_items_pedido (origem, cliente_id, pedido_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
