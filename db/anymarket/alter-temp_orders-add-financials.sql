ALTER TABLE temp_orders
  ADD COLUMN gross DECIMAL(10,2) DEFAULT NULL COMMENT 'Total bruto sem frete',
  ADD COLUMN discount DECIMAL(10,2) DEFAULT NULL COMMENT 'Valor de desconto',
  ADD COLUMN total DECIMAL(10,2) DEFAULT NULL COMMENT 'Total final do pedido';
