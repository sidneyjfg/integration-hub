ALTER TABLE tmp_notas
  ADD COLUMN valor_pedido DECIMAL(18,2) NULL
  AFTER valor_total;
