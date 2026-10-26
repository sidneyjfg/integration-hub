-- Tabela de monitoramento de pedidos da Wake (Fbits).
-- Tabela propria por hub: nao usa `temp_orders` para nao colidir com
-- anymarket e pluggto, que gravam o mesmo nome de tabela no mesmo schema.
-- Nao grava nota fiscal: a Wake nao e monitorada para NF neste hub.
CREATE TABLE IF NOT EXISTS temp_orders_wake (
  ordnoweb VARCHAR(255) NOT NULL,
  ordnochannel VARCHAR(255) NOT NULL,
  status VARCHAR(100) NOT NULL,
  status_name VARCHAR(100) NULL,
  total DECIMAL(15,2) NULL,
  date DATETIME NOT NULL,
  PRIMARY KEY (ordnoweb)
) ENGINE=InnoDB;
