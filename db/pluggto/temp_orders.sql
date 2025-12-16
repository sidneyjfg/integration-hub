CREATE TABLE IF NOT EXISTS temp_orders (
  ordnoweb VARCHAR(255) NOT NULL,
  ordnochannel VARCHAR(255) NOT NULL,
  nfe_key VARCHAR(44),
  date DATETIME NOT NULL,
  status VARCHAR(100) NOT NULL,
  PRIMARY KEY (ordnoweb)
) ENGINE=InnoDB;
