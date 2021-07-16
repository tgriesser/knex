const { expect } = require('chai');
const {
  getAllDbs,
  getKnexForDb,
} = require('../../util/knex-instance-provider');
require('../../../util/chai-setup');

describe('whereILike', () => {
  getAllDbs()
    .filter(
      (db) =>
        db.startsWith('postgres') ||
        db.startsWith('mssql') ||
        db.startsWith('mysql')
    )
    .forEach((db) => {
      describe(db, () => {
        let knex;
        const tblName = 'test_table';
        const colName = 'test_col';

        before(async () => {
          knex = getKnexForDb(db);
          await knex.schema.dropTableIfExists(tblName);
          await knex.schema.createTable(tblName, (table) => {
            table.string(colName);
          });
          await knex(tblName).insert({
            [colName]: 'Cake',
          });
        });

        after(async () => {
          await knex.schema.dropTable(tblName);
          return knex.destroy();
        });

        it('finds data using whereILike', async () => {
          const result = await knex(tblName)
            .select('*')
            .whereILike(colName, 'Cake');
          expect(result).to.deep.equal([
            {
              [colName]: 'Cake',
            },
          ]);
        });
        it('finds data using whereILike when different case sensitivity', async () => {
          const result = await knex(tblName).whereILike(colName, 'cake');
          expect(result).to.deep.equal([
            {
              [colName]: 'Cake',
            },
          ]);
        });
      });
    });
});
