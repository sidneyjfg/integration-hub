ALTER TABLE temp_orders
  -- nota fiscal
  ADD COLUMN nfe_number VARCHAR(20) NULL,
  ADD COLUMN nfe_serie VARCHAR(10) NULL,
  ADD COLUMN nfe_date DATETIME NULL,

  -- valores
  ADD COLUMN total DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN subtotal DECIMAL(15,2) NULL,
  ADD COLUMN shipping DECIMAL(15,2) NULL,
  ADD COLUMN discount DECIMAL(15,2) NULL,
  ADD COLUMN tax DECIMAL(15,2) NULL,
  ADD COLUMN total_paid DECIMAL(15,2) NULL,

  -- pagamento
  ADD COLUMN payment_type VARCHAR(50) NULL,
  ADD COLUMN payment_method VARCHAR(50) NULL,
  ADD COLUMN payment_installments INT NULL,

  -- metadados
  ADD COLUMN channel VARCHAR(50) NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN channel_account VARCHAR(255) NULL,
  ADD COLUMN delivery_type VARCHAR(50) NULL,

  -- datas
  ADD COLUMN approved_at DATETIME NULL,
  ADD COLUMN modified_at DATETIME NULL;
