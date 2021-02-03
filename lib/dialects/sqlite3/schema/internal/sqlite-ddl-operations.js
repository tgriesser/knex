const identity = require('lodash/identity');
const chunk = require('lodash/chunk');

function insertChunked(trx, chunkSize, target, iterator, existingData) {
  const result = [];
  iterator = iterator || identity;
  const chunked = chunk(existingData, chunkSize);
  for (const batch of chunked) {
    result.push(
      trx.queryBuilder().table(target).insert(batch.map(iterator)).toQuery()
    );
  }
  return result;
}

function createTempTable(createTable, tablename, alteredName) {
  return createTable.sql.replace(tablename, alteredName);
}

// ToDo To be removed
async function copyData(trx, tableName, alteredName) {
  const existingData = await trx.raw(`SELECT * FROM "${tableName}"`);
  return insertChunked(trx, 20, alteredName, identity, existingData);
}

// ToDo To be removed
async function reinsertData(trx, iterator, tableName, alteredName) {
  const existingData = await trx.raw(`SELECT * FROM "${alteredName}"`);
  return insertChunked(trx, 20, tableName, iterator, existingData);
}

function copyAllData(sourceTable, targetTable) {
  return `INSERT INTO ${targetTable} SELECT * FROM ${sourceTable};`;
}

function dropOriginal(tableName) {
  return `DROP TABLE "${tableName}"`;
}

function dropTempTable(alteredName) {
  return `DROP TABLE "${alteredName}"`;
}

function renameTable(tableName, alteredName) {
  return `ALTER TABLE "${tableName}" RENAME TO "${alteredName}"`;
}

function getTableSql(tableName) {
  return `SELECT name, sql FROM sqlite_master WHERE type="table" AND name="${tableName}"`;
}

function isForeignKeys() {
  return `PRAGMA foreign_keys`;
}

function setForeignKeys(enable) {
  return `PRAGMA foreign_keys = ${enable ? 'ON' : 'OFF'}`;
}

function checkForeignKeys() {
  return `PRAGMA foreign_key_check`;
}

function trxBegin() {
  return `BEGIN`;
}

function trxCommit() {
  return `COMMIT`;
}

function createKeysErrorTable() {
  return `CREATE TEMP TABLE foreign_keys_error(c)`;
}

function createCheckErrorTable() {
  return `CREATE TEMP TABLE foreign_check_error(c)`;
}

function dropKeysErrorTable() {
  return `DROP TABLE temp.foreign_keys_error`;
}

function dropCheckErrorTable() {
  return `DROP TABLE temp.foreign_check_error`;
}

function createKeysErrorTrigger() {
  return `CREATE TEMP TRIGGER foreign_keys_trigger BEFORE INSERT ON temp.foreign_keys_error WHEN NEW.c IS NOT 0 BEGIN SELECT RAISE(ROLLBACK, "FOREIGN KEY constraint failed"); END`;
}

function createCheckErrorTrigger() {
  return `CREATE TEMP TRIGGER foreign_check_trigger BEFORE INSERT ON temp.foreign_check_error WHEN NEW.c IS 0 BEGIN SELECT RAISE(ROLLBACK, "FOREIGN KEY mismatch"); END`;
}

function rollbackOnKeysError() {
  return `INSERT INTO temp.foreign_keys_error SELECT COUNT(*) FROM pragma_foreign_key_check`;
}

function rollbackOnCheckError() {
  return `INSERT INTO temp.foreign_check_error SELECT COUNT(*) FROM temp.foreign_keys_error`;
}

module.exports = {
  copyAllData,
  copyData,
  createTempTable,
  dropOriginal,
  dropTempTable,
  reinsertData,
  renameTable,
  getTableSql,
  isForeignKeys,
  setForeignKeys,
  checkForeignKeys,
  trxBegin,
  trxCommit,
  createKeysErrorTable,
  createCheckErrorTable,
  dropKeysErrorTable,
  dropCheckErrorTable,
  createKeysErrorTrigger,
  createCheckErrorTrigger,
  rollbackOnKeysError,
  rollbackOnCheckError,
};
