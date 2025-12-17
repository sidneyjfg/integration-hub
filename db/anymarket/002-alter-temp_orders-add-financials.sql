-- gross
SET @col := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'temp_orders'
    AND COLUMN_NAME = 'gross'
);

SET @sql := IF(
  @col = 0,
  'ALTER TABLE temp_orders ADD COLUMN gross DECIMAL(10,2) DEFAULT NULL COMMENT ''Total bruto sem frete''',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- discount
SET @col := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'temp_orders'
    AND COLUMN_NAME = 'discount'
);

SET @sql := IF(
  @col = 0,
  'ALTER TABLE temp_orders ADD COLUMN discount DECIMAL(10,2) DEFAULT NULL COMMENT ''Valor de desconto''',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- total
SET @col := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'temp_orders'
    AND COLUMN_NAME = 'total'
);

SET @sql := IF(
  @col = 0,
  'ALTER TABLE temp_orders ADD COLUMN total DECIMAL(10,2) DEFAULT NULL COMMENT ''Total final do pedido''',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
