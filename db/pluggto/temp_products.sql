CREATE TABLE IF NOT EXISTS temp_products (
  idNerus VARCHAR(255) NOT NULL,
  idPluggto VARCHAR(255) NOT NULL,
  ean VARCHAR(13),
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  pricePromotion DECIMAL(10,2),
  stock INT,
  PRIMARY KEY (idPluggto)
) ENGINE=InnoDB;
