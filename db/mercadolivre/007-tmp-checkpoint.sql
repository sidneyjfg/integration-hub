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
