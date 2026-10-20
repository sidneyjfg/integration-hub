-- Tabela de monitoramento de estoque da TrayCommerce.
-- Tabela propria por hub: nao usa `temp_products` para nao colidir com
-- anymarket, pluggto e traycorp, que gravam o mesmo nome no mesmo schema.
-- Nao grava preco: preco tera um monitoramento proprio.
CREATE TABLE IF NOT EXISTS temp_traycommerce_stock (
  id BIGINT(20) NOT NULL AUTO_INCREMENT,
  id_tray BIGINT(20) NOT NULL,
  reference VARCHAR(255) NOT NULL,
  name VARCHAR(500) DEFAULT NULL,
  stock INT(11) DEFAULT NULL,
  is_variant TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unique_id_tray (id_tray),
  KEY idx_reference (reference)
) ENGINE=InnoDB;
