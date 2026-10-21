CREATE TABLE IF NOT EXISTS tmp_order (
  origem VARCHAR(40) NOT NULL,
  cliente_id VARCHAR(32) NOT NULL,
  pedido_id VARCHAR(32) NOT NULL,
  pack_id VARCHAR(32) DEFAULT NULL,
  data_criacao DATETIME DEFAULT NULL,
  data_fechamento DATETIME DEFAULT NULL,
  status VARCHAR(40) DEFAULT NULL,
  moeda VARCHAR(8) DEFAULT NULL,
  valor_total DECIMAL(18,2) DEFAULT NULL,
  shipping_id VARCHAR(32) DEFAULT NULL,
  tipo_logistico VARCHAR(40) DEFAULT NULL,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (origem, cliente_id, pedido_id),
  KEY idx_tmp_order_data (origem, data_criacao),
  KEY idx_tmp_order_shipping (shipping_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

CREATE TABLE IF NOT EXISTS tmp_checkpoint (
  origem VARCHAR(40) NOT NULL,
  processo VARCHAR(40) NOT NULL,
  cliente_id VARCHAR(80) NOT NULL,
  cursor_data DATETIME NOT NULL,
  ultima_execucao TIMESTAMP NULL DEFAULT NULL,
  incidente_em DATETIME DEFAULT NULL,
  ultimo_erro TEXT DEFAULT NULL,
  dados_checkpoint LONGTEXT DEFAULT NULL,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (origem, processo, cliente_id),
  KEY idx_tmp_checkpoint_incidente (incidente_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
