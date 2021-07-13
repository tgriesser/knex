'use strict';

const { expect } = require('chai');
const { TEST_TIMESTAMP } = require('../../util/constants');
const { isMssql } = require('../../util/db-helpers');

module.exports = function (knex) {
  describe('Updates with Triggers', function () {
    // Trigger options
    const triggerOptions = { includeTriggerModifications: true };

    before(function () {
      if (!isMssql(knex)) {
        this.skip('This test is MSSQL only');
      }
    });

    describe('Trigger Specific Tests', function () {
      // Reused variables
      // Table Names
      const primaryTable = 'test_return_with_trigger_primary';
      const secondaryTable = 'test_return_with_trigger_secondary';

      // Foreign Key Column Names
      const primaryLink = 'foreign_id';
      const secondaryLink = 'looping_id';

      // Trigger Name
      const triggerName = 'tr_test_insert_with_trigger';

      // Create proper environment for tests
      before(async function () {
        if (!isMssql(knex)) {
          this.skip('This test is MSSQL only');
        }

        await knex.schema.hasTable('users').then(async function (exists) {
          if (exists) {
            await knex.schema.dropTable(primaryTable);
            await knex.schema.dropTable(secondaryTable);
          }

          // Create tables
          await knex.schema.createTable(primaryTable, function (table) {
            table.increments().primary();
            table.string('data').defaultsTo('');
            table.integer(primaryLink).nullable();
          });

          await knex.schema.createTable(secondaryTable, function (table) {
            table.increments().primary();
            table.string('data').defaultsTo('');
            table.integer(secondaryLink).nullable();
          });

          await knex.raw(`
                        CREATE TRIGGER [${triggerName}] ON [${secondaryTable}]
                        AFTER UPDATE
                        AS 
                        BEGIN
                            SET NOCOUNT ON;

                            BEGIN
                                update pt
                                set pt.${primaryLink} = i.id
                                from Inserted as i
                                inner join ${primaryTable} as pt
                                    on pt.id = i.${secondaryLink}
                            END
                        END
                `);
        });
      });

      // Clean-up test specific tables
      after(async function () {
        if (!isMssql(knex)) {
          return;
        }

        // Drop table (Trigger is removed with table)
        await knex.schema.dropTable(primaryTable);
        await knex.schema.dropTable(secondaryTable);
      });

      // Reset tables for each test
      beforeEach(async function () {
        // "Truncate" tables instead of recreate for each test for speed gains
        await knex.raw(`
                delete from ${primaryTable} dbcc checkident('${primaryTable}', reseed, 0);
                delete from ${secondaryTable} dbcc checkident('${secondaryTable}', reseed, 0);
            `);
      });

      it('#4152 Should allow returns with updates on tables with triggers', async function () {
        let reachedEnd = false;

        await knex.transaction(async function () {
          let updateResults;

          async function updateWithReturn() {
            const insertPrimary = {
              data: 'Testing Data',
            };

            const insertSecondary = {
              data: 'Test Linking',
            };

            const primaryId = await knex(primaryTable).insert(
              [insertPrimary],
              ['id'],
              triggerOptions
            );

            // Test retrieve with trigger
            const secondaryId = (
              await knex(secondaryTable).insert(
                [insertSecondary],
                ['id'],
                triggerOptions
              )
            )[0].id;

            const updateSecondary = {};
            updateSecondary[secondaryLink] = primaryId[0].id;

            updateResults = await knex(secondaryTable)
              .where('id', '=', secondaryId)
              .update(updateSecondary, ['id'], triggerOptions);
          }

          await updateWithReturn();

          expect(Number.parseInt(updateResults[0].id)).to.be.finite;

          reachedEnd = true;
        });

        expect(reachedEnd).to.be.true;
      });

      it('#4152 Should allow returns with updates on tables with triggers using returning function', async function () {
        let reachedEnd = false;

        await knex.transaction(async function () {
          let updateResults;

          async function updateWithReturn() {
            const insertPrimary = {
              data: 'Testing Data',
            };

            const insertSecondary = {
              data: 'Test Linking',
            };

            const primaryId = await knex(primaryTable).insert(
              [insertPrimary],
              ['id'],
              triggerOptions
            );

            // Test retrieve with trigger
            const secondaryId = (
              await knex(secondaryTable).insert(
                [insertSecondary],
                ['id'],
                triggerOptions
              )
            )[0].id;

            const updateSecondary = {};
            updateSecondary[secondaryLink] = primaryId[0].id;

            updateResults = await knex(secondaryTable)
              .where('id', '=', secondaryId)
              .returning(['id'], triggerOptions)
              .update(updateSecondary);
          }

          await updateWithReturn();

          expect(Number.parseInt(updateResults[0].id)).to.be.finite;

          reachedEnd = true;
        });

        expect(reachedEnd).to.be.true;
      });
    });

    describe('Re-test all Update Functions with trigger option and returns', function () {
      before(async function () {
        if (!isMssql(knex)) {
          this.skip('This test is MSSQL only');
        }

        // Reset all table data to original stats of original tests
      });

      it('should allow returning for updates in postgresql', function () {
        return knex('accounts')
          .where('id', 1)
          .update(
            {
              email: 'test100@example.com',
              first_name: 'UpdatedUser',
              last_name: 'UpdatedTest',
            },
            '*',
            triggerOptions
          )
          .testSql(function (tester) {
            tester(
              'mysql',
              'update `accounts` set `email` = ?, `first_name` = ?, `last_name` = ? where `id` = ?',
              ['test100@example.com', 'UpdatedUser', 'UpdatedTest', 1],
              1
            );
            tester(
              'pg',
              'update "accounts" set "email" = ?, "first_name" = ?, "last_name" = ? where "id" = ? returning *',
              ['test100@example.com', 'UpdatedUser', 'UpdatedTest', 1],
              [
                {
                  id: '1',
                  first_name: 'UpdatedUser',
                  last_name: 'UpdatedTest',
                  email: 'test100@example.com',
                  logins: 1,
                  balance: 0,
                  about: 'Lorem ipsum Dolore labore incididunt enim.',
                  created_at: TEST_TIMESTAMP,
                  updated_at: TEST_TIMESTAMP,
                  phone: null,
                },
              ]
            );
            tester(
              'pg-redshift',
              'update "accounts" set "email" = ?, "first_name" = ?, "last_name" = ? where "id" = ?',
              ['test100@example.com', 'UpdatedUser', 'UpdatedTest', 1],
              1
            );
            tester(
              'sqlite3',
              'update `accounts` set `email` = ?, `first_name` = ?, `last_name` = ? where `id` = ?',
              ['test100@example.com', 'UpdatedUser', 'UpdatedTest', 1],
              1
            );
            tester(
              'oracledb',
              'update "accounts" set "email" = ?, "first_name" = ?, "last_name" = ? where "id" = ? returning "ROWID" into ?',
              [
                'test100@example.com',
                'UpdatedUser',
                'UpdatedTest',
                1,
                (v) => v.toString() === '[object ReturningHelper:ROWID]',
              ],
              1
            );
            tester(
              'mssql',
              'select top(0) [t].* into #out from [accounts] as t left join [accounts] on 0=1;update [accounts] set [email] = ?, [first_name] = ?, [last_name] = ? output inserted.* into #out where [id] = ?; select * from #out; drop table #out;',
              ['test100@example.com', 'UpdatedUser', 'UpdatedTest', 1],
              [
                {
                  id: '1',
                  first_name: 'UpdatedUser',
                  last_name: 'UpdatedTest',
                  email: 'test100@example.com',
                  logins: 1,
                  balance: 0,
                  about: 'Lorem ipsum Dolore labore incididunt enim.',
                  created_at: TEST_TIMESTAMP,
                  updated_at: TEST_TIMESTAMP,
                  phone: null,
                },
              ]
            );
          });
      });
    });
  });
};
