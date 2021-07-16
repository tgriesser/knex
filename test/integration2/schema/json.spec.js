const { expect } = require('chai');
const { getAllDbs, getKnexForDb } = require('../util/knex-instance-provider');
const { isSQLite } = require('../../util/db-helpers');

describe('Schema', () => {
  describe('json columns', () => {
    getAllDbs()
      // no support for json in mssql and oracledb, omit test
      .filter((db) => !['mssql', 'oracledb'].includes(db))
      .forEach((db) => {
        describe(db, () => {
          let knex;
          const tblName = 'table_with_json_col1';
          const colName = 'json_col1';

          before(async () => {
            knex = getKnexForDb(db);
            await knex.schema.dropTableIfExists(tblName);
            await knex.schema.createTable(tblName, (table) => {
              table.json(colName);
            });
          });

          after(async () => {
            await knex.schema.dropTable(tblName);
            return knex.destroy();
          });

          it('JSON data is correctly serialized and deserialized', async () => {
            const data = {
              name: 'Jimi',
            };

            if (!isSQLite(knex)) {
              await knex(tblName).insert({
                [colName]: data,
              });
            } else {
              await knex(tblName).insert({
                [colName]: JSON.stringify(data),
              });
            }

            const jsonValue = await knex(tblName).select().from(tblName);

            if (!isSQLite(knex)) {
              expect(jsonValue).to.deep.eq([{ json_col1: { name: 'Jimi' } }]);
            } else {
              expect(JSON.parse(jsonValue[0].json_col1)).to.deep.eq({
                name: 'Jimi',
              });
            }
          });
        });
      });
  });
});
