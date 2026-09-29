-- Tabela de monitoramento de pedidos da TrayCommerce.
-- Tabela propria por hub: nao usa `temp_orders` para nao colidir com
-- anymarket e pluggto, que gravam o mesmo nome de tabela no mesmo schema.
CREATE TABLE IF NOT EXISTS temp_orders_traycommerce (
  ordnoweb VARCHAR(255) NOT NULL,
  ordnochannel VARCHAR(255) NOT NULL,
  nfe_key VARCHAR(44),
  date DATETIME NOT NULL,
  status VARCHAR(100) NOT NULL,
  PRIMARY KEY (ordnoweb)
) ENGINE=InnoDB;
