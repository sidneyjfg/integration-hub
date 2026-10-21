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
