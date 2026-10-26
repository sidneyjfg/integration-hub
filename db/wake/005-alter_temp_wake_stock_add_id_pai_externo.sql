-- Id do produto pai na Wake, mantido junto do `prdno` para referencia.
ALTER TABLE temp_wake_stock
  ADD COLUMN id_pai_externo VARCHAR(255) DEFAULT NULL;
