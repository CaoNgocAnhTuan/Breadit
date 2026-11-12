-- Q0: tables, columns and time range of steemit-307308.hive_zurich (task p7-hive-check, plan Step 3).
-- Run each part on its own in the BigQuery console. Q0a and Q0b read metadata only.
-- Q0c reads one column of every table: dry-run it first and note the bytes.

-- Q0a: the tables and their sizes.
SELECT table_id, row_count, size_bytes
FROM `steemit-307308.hive_zurich.__TABLES__`
ORDER BY table_id;

-- Q0b: every nested field path and type of one table (the operations live inside `transactions`).
SELECT field_path, data_type
FROM `steemit-307308.hive_zurich.INFORMATION_SCHEMA.COLUMN_FIELD_PATHS`
WHERE table_name = 'block_data_48000001_50000000_33'
ORDER BY field_path;

-- Q0c: first and last block time of each table (only the `timestamp` column is read).
SELECT _TABLE_SUFFIX AS suffix, MIN(timestamp) AS first_t, MAX(timestamp) AS last_t, COUNT(*) AS blocks
FROM `steemit-307308.hive_zurich.block_data_*`
GROUP BY suffix
ORDER BY suffix;
