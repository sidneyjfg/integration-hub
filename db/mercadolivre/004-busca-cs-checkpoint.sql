CREATE TABLE IF NOT EXISTS busca_cs_checkpoint (
  contas CHAR(64) NOT NULL,
  mes CHAR(6) NOT NULL,
  retomar_dia CHAR(8) NOT NULL,
  bloco_inicio CHAR(8) NOT NULL,
  bloco_fim CHAR(8) NOT NULL,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (contas, mes)
) ENGINE=InnoDB;
