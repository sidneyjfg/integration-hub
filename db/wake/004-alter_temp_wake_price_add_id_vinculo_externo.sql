-- `id_vinculo_externo` e o `prdno` do Nérus; o ERP cruza por esta coluna.
-- O `sku`/EAN continua na tabela apenas como referencia.
ALTER TABLE temp_wake_price
  ADD COLUMN id_vinculo_externo VARCHAR(255) DEFAULT NULL;
