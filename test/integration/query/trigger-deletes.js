'use strict';

const { expect } = require('chai');
const { TEST_TIMESTAMP } = require('../../util/constants');
const { isMssql } = require('../../util/db-helpers');

module.exports = function (knex) {
  describe('Deletes with Triggers', function () {
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
      const triggerName = 'tr_test_delete_with_trigger';

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
                        CREATE TRIGGER [dbo].[${triggerName}] ON [dbo].[${secondaryTable}]
                        AFTER DELETE
                        AS 
                        BEGIN
                            SET NOCOUNT ON;

                            BEGIN
                                delete ${primaryTable}
                                from ${primaryTable} as pt
                                    inner join deleted as d
                                        on pt.id = d.${secondaryLink}
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

      it('#4152 Should allow returns with deletes on tables with triggers', async function () {
        let reachedEnd = false;

        await knex.transaction(async function () {
          let insertedId;
          let deletedId;

          async function insertWithReturn() {
            const insertPrimary = {
              data: 'Testing Data',
            };

            const insertSecondary = {
              data: 'Test Linking',
            };

            // Setup primary table for trigger use case
            const primaryId = await knex(primaryTable).insert(
              [insertPrimary],
              ['id'],
              triggerOptions
            );
            insertSecondary[secondaryLink] = primaryId[0].id;

            // Insert to table with trigger to test delete
            insertedId = (
              await knex(secondaryTable).insert(
                [insertSecondary],
                ['id'],
                triggerOptions
              )
            )[0].id;
          }

          async function deleteTriggerTable() {
            // Test returning value from delete statement on a table with a trigger
            deletedId = (
              await knex(secondaryTable)
                .whereRaw(`id = ${insertedId}`)
                .delete(['id'], triggerOptions)
            )[0].id;
          }

          await insertWithReturn();
          await deleteTriggerTable();

          expect(Number.parseInt(deletedId)).to.be.finite;

          reachedEnd = true;
        });

        expect(reachedEnd).to.be.true;
      });

      it('#4152 Should allow returns with deletes on tables with triggers using returning function', async function () {
        let reachedEnd = false;

        await knex.transaction(async function () {
          let insertedId;
          let deletedId;

          async function insertWithReturn() {
            const insertPrimary = {
              data: 'Testing Data',
            };

            const insertSecondary = {
              data: 'Test Linking',
            };

            // Setup primary table for trigger use case
            const primaryId = await knex(primaryTable).insert(
              [insertPrimary],
              ['id'],
              triggerOptions
            );
            insertSecondary[secondaryLink] = primaryId[0].id;

            // Insert to table with trigger to test delete
            insertedId = (
              await knex(secondaryTable).insert(
                [insertSecondary],
                ['id'],
                triggerOptions
              )
            )[0].id;
          }

          async function deleteTriggerTable() {
            // Test returning value from delete statement on a table with a trigger
            deletedId = (
              await knex(secondaryTable)
                .whereRaw(`id = ${insertedId}`)
                .returning(['id'], triggerOptions)
                .delete()
            )[0].id;
          }

          await insertWithReturn();
          await deleteTriggerTable();

          expect(Number.parseInt(deletedId)).to.be.finite;

          reachedEnd = true;
        });

        expect(reachedEnd).to.be.true;
      });
    });

    describe('Re-test all Delete Functions with trigger option and returns', function () {
      before(async function () {
        if (!isMssql(knex)) {
          this.skip('This test is MSSQL only');
        }

        // Reset all table data to original stats of original tests
      });

      it('should allow returning for deletes in postgresql and mssql', function () {
        return knex('accounts')
          .where('id', 2)
          .del('*', triggerOptions)
          .testSql(function (tester) {
            tester('mysql', 'delete from `accounts` where `id` = ?', [2], 1);
            tester(
              'pg',
              'delete from "accounts" where "id" = ? returning *',
              [2],
              [
                {
                  id: '2',
                  first_name: 'Test',
                  last_name: 'User',
                  email: 'test2@example.com',
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
              'delete from "accounts" where "id" = ?',
              [2],
              1
            );
            tester('sqlite3', 'delete from `accounts` where `id` = ?', [2], 1);
            tester('oracledb', 'delete from "accounts" where "id" = ?', [2], 1);
            tester(
              'mssql',
              'select top(0) [t].* into #out from [accounts] as t left join [accounts] on 0=1;delete from [accounts] output deleted.* into #out where [id] = ?; select * from #out; drop table #out;',
              [2],
              [
                {
                  id: '2',
                  first_name: 'Test',
                  last_name: 'User',
                  email: 'test2@example.com',
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
    it('should handle delete with join and trigger options', function () {
      return knex('test_table_two')
        .join('accounts', 'accounts.id', 'test_table_two.account_id')
        .where({ 'accounts.email': 'test3@example.com' })
        .del('*', triggerOptions)
        .testSql(function (tester) {
          tester(
            'mssql',
            'select top(0) [t].* into #out from [test_table_two] as t left join [test_table_two] on 0=1;delete [test_table_two] output deleted.* into #out from [test_table_two] inner join [accounts] on [accounts].[id] = [test_table_two].[account_id] where [accounts].[email] = ?; select * from #out; drop table #out;',
            ['test3@example.com'],
            [{ id: 3, account_id: 3, details: '', status: 1, json_data: null }]
          );
        });
    });
  });
};
