const { expect } = require('chai');
const { getAllDbs, getKnexForDb } = require('../util/knex-instance-provider');

describe('Schema', () => {
  describe('jsonb columns', () => {
    getAllDbs()
      // no support for json in mssql and oracledb, omit test
      .filter((db) => !['mssql', 'oracledb'].includes(db))
      .forEach((db) => {
        describe(db, () => {
          let knex;
          const tblName = 'table_with_jsonb_col1';
          const colName = 'jsonb_col1';

          before(async () => {
            knex = getKnexForDb(db);
            await knex.schema.dropTableIfExists(tblName);
            await knex.schema.createTable(tblName, (table) => {
              table.jsonb(colName);
            });
          });

          after(async () => {
            await knex.schema.dropTable(tblName);
            return knex.destroy();
          });

          it('JSONB falls back to JSON for unsupported drivers', async () => {
            let res;
            switch (db) {
              case 'sqlite3':
                res = await knex.schema.raw(`PRAGMA table_info(${tblName})`);
                expect(res.find((c) => c.name === colName).type).to.equal(
                  'json'
                );
                break;
              case 'postgres':
                res = await knex
                  .select('data_type')
                  .from('information_schema.columns')
                  .where({ table_name: tblName, column_name: colName });
                expect(res[0].data_type).to.equal('jsonb');
                break;
              case 'mysql':
              case 'mysql2':
                res = await knex
                  .select('DATA_TYPE')
                  .from('INFORMATION_SCHEMA.COLUMNS')
                  .where({ table_name: tblName, column_name: colName });
                expect(res[0].DATA_TYPE).to.equal('json');
                break;
            }
          });
        });
      });
  });
});
