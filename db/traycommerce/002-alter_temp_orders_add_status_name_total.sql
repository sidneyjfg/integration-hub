-- Colunas que a busca de pedidos da TrayCommerce precisa alem do que o
-- 001 cria. Fica em arquivo separado de proposito: o 001 nao muda, assim
-- base nova e base que ja rodou a migration 001 seguem pelo mesmo caminho
-- (o runner tolera coluna repetida, mas aqui nem precisa ocorrer).
ALTER TABLE temp_orders_traycommerce
  -- texto do status, para o relatorio do ERP nao depender de traducao de id
  ADD COLUMN status_name VARCHAR(100) NULL,
  -- valor do pedido na TrayCommerce
  ADD COLUMN total DECIMAL(15,2) NULL;
