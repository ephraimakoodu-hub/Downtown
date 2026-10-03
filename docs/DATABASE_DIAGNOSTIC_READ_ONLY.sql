-- Downtown Supermarket: READ-ONLY database inventory
-- Safe to run in phpMyAdmin. Every statement below is SELECT-only.
-- Select the downtown_supermarket database before running this script.

-- 1. Database identity and server version.
SELECT DATABASE() AS selected_database, VERSION() AS mysql_version;

-- 2. Tables, estimated rows, engine, collation and size.
SELECT
  TABLE_NAME,
  TABLE_ROWS AS estimated_rows,
  ENGINE,
  TABLE_COLLATION,
  ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024, 1) AS size_kib
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;

-- 3. All columns, types, nullability, defaults and key markers.
SELECT
  TABLE_NAME,
  ORDINAL_POSITION,
  COLUMN_NAME,
  COLUMN_TYPE,
  IS_NULLABLE,
  COLUMN_DEFAULT,
  COLUMN_KEY,
  EXTRA
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME, ORDINAL_POSITION;

-- 4. Index definitions.
SELECT
  TABLE_NAME,
  INDEX_NAME,
  NON_UNIQUE,
  SEQ_IN_INDEX,
  COLUMN_NAME,
  INDEX_TYPE
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

-- 5. Foreign-key relationships.
SELECT
  TABLE_NAME,
  COLUMN_NAME,
  CONSTRAINT_NAME,
  REFERENCED_TABLE_NAME,
  REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
  AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION;

-- 6. Check whether migration history exists.
SELECT
  COUNT(*) AS migration_tracker_exists
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'schema_migrations';

-- 7. Row counts for the most important business tables.
-- Exact counts are obtained dynamically by the phpMyAdmin table view;
-- TABLE_ROWS above is approximate for InnoDB.
