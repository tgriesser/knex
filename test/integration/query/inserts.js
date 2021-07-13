'use strict';

const { expect } = require('chai');

const _ = require('lodash');
const sinon = require('sinon');

const { TEST_TIMESTAMP } = require('../../util/constants');
const {
  isRedshift,
  isPostgreSQL,
  isSQLite,
  isMssql,
  isMysql,
  isOracle,
} = require('../../util/db-helpers');

module.exports = function (knex) {
  describe('Inserts', function () {
    it('should handle simple inserts', function () {
      return knex('accounts')
        .insert(
          {
            first_name: 'Test',
            last_name: 'User',
            email: 'test@example.com',
            logins: 1,
            about: 'Lorem ipsum Dolore labore incididunt enim.',
            created_at: TEST_TIMESTAMP,
            updated_at: TEST_TIMESTAMP,
          },
          'id'
        )
        .testSql(function (tester) {
          tester(
            'mysql',
            'insert into `accounts` (`about`, `created_at`, `email`, `first_name`, `last_name`, `logins`, `updated_at`) values (?, ?, ?, ?, ?, ?, ?)',
            [
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test@example.com',
              'Test',
              'User',
              1,
              TEST_TIMESTAMP,
            ],
            [1]
          );
          tester(
            'pg',
            'insert into "accounts" ("about", "created_at", "email", "first_name", "last_name", "logins", "updated_at") values (?, ?, ?, ?, ?, ?, ?) returning "id"',
            [
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test@example.com',
              'Test',
              'User',
              1,
              TEST_TIMESTAMP,
            ],
            [
              {
                id: '1',
              },
            ]
          );
          tester(
            'pg-redshift',
            'insert into "accounts" ("about", "created_at", "email", "first_name", "last_name", "logins", "updated_at") values (?, ?, ?, ?, ?, ?, ?)',
            [
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test@example.com',
              'Test',
              'User',
              1,
              TEST_TIMESTAMP,
            ],
            1
          );
          tester(
            'sqlite3',
            'insert into `accounts` (`about`, `created_at`, `email`, `first_name`, `last_name`, `logins`, `updated_at`) values (?, ?, ?, ?, ?, ?, ?)',
            [
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test@example.com',
              'Test',
              'User',
              1,
              TEST_TIMESTAMP,
            ],
            [1]
          );
          tester(
            'oracledb',
            'insert into "accounts" ("about", "created_at", "email", "first_name", "last_name", "logins", "updated_at") values (?, ?, ?, ?, ?, ?, ?) returning "id" into ?',
            [
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test@example.com',
              'Test',
              'User',
              1,
              TEST_TIMESTAMP,
              function (v) {
                return v.toString() === '[object ReturningHelper:id]';
              },
            ],
            [{ id: '1' }]
          );
          tester(
            'mssql',
            'insert into [accounts] ([about], [created_at], [email], [first_name], [last_name], [logins], [updated_at]) output inserted.[id] values (?, ?, ?, ?, ?, ?, ?)',
            [
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test@example.com',
              'Test',
              'User',
              1,
              TEST_TIMESTAMP,
            ],
            [
              {
                id: '1',
              },
            ]
          );
        });
    });

    it('should handle multi inserts', function () {
      return knex('accounts')
        .insert(
          [
            {
              first_name: 'Test',
              last_name: 'User',
              email: 'test2@example.com',
              logins: 1,
              about: 'Lorem ipsum Dolore labore incididunt enim.',
              created_at: TEST_TIMESTAMP,
              updated_at: TEST_TIMESTAMP,
            },
            {
              first_name: 'Test',
              last_name: 'User',
              email: 'test3@example.com',
              about: 'Lorem ipsum Dolore labore incididunt enim.',
              logins: 2,
              created_at: TEST_TIMESTAMP,
              updated_at: TEST_TIMESTAMP,
            },
          ],
          'id'
        )
        .testSql(function (tester) {
          tester(
            'mysql',
            'insert into `accounts` (`about`, `created_at`, `email`, `first_name`, `last_name`, `logins`, `updated_at`) values (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)',
            [
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test2@example.com',
              'Test',
              'User',
              1,
              TEST_TIMESTAMP,
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test3@example.com',
              'Test',
              'User',
              2,
              TEST_TIMESTAMP,
            ],
            [2]
          );
          tester(
            'pg',
            'insert into "accounts" ("about", "created_at", "email", "first_name", "last_name", "logins", "updated_at") values (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?) returning "id"',
            [
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test2@example.com',
              'Test',
              'User',
              1,
              TEST_TIMESTAMP,
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test3@example.com',
              'Test',
              'User',
              2,
              TEST_TIMESTAMP,
            ],
            [
              {
                id: '2',
              },
              {
                id: '3',
              },
            ]
          );
          tester(
            'pg-redshift',
            'insert into "accounts" ("about", "created_at", "email", "first_name", "last_name", "logins", "updated_at") values (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)',
            [
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test2@example.com',
              'Test',
              'User',
              1,
              TEST_TIMESTAMP,
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test3@example.com',
              'Test',
              'User',
              2,
              TEST_TIMESTAMP,
            ],
            2
          );
          tester(
            'sqlite3',
            'insert into `accounts` (`about`, `created_at`, `email`, `first_name`, `last_name`, `logins`, `updated_at`) select ? as `about`, ? as `created_at`, ? as `email`, ? as `first_name`, ? as `last_name`, ? as `logins`, ? as `updated_at` union all select ? as `about`, ? as `created_at`, ? as `email`, ? as `first_name`, ? as `last_name`, ? as `logins`, ? as `updated_at`',
            [
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test2@example.com',
              'Test',
              'User',
              1,
              TEST_TIMESTAMP,
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test3@example.com',
              'Test',
              'User',
              2,
              TEST_TIMESTAMP,
            ],
            [3]
          );
          tester(
            'oracledb',
            'begin execute immediate \'insert into "accounts" ("about", "created_at", "email", "first_name", "last_name", "logins", "updated_at") values (:1, :2, :3, :4, :5, :6, :7) returning "id" into :8\' using ?, ?, ?, ?, ?, ?, ?, out ?; execute immediate \'insert into "accounts" ("about", "created_at", "email", "first_name", "last_name", "logins", "updated_at") values (:1, :2, :3, :4, :5, :6, :7) returning "id" into :8\' using ?, ?, ?, ?, ?, ?, ?, out ?;end;',
            [
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test2@example.com',
              'Test',
              'User',
              1,
              TEST_TIMESTAMP,
              function (v) {
                return v.toString() === '[object ReturningHelper:id]';
              },
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test3@example.com',
              'Test',
              'User',
              2,
              TEST_TIMESTAMP,
              function (v) {
                return v.toString() === '[object ReturningHelper:id]';
              },
            ],
            [{ id: '2' }, { id: '3' }]
          );
          tester(
            'mssql',
            'insert into [accounts] ([about], [created_at], [email], [first_name], [last_name], [logins], [updated_at]) output inserted.[id] values (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)',
            [
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test2@example.com',
              'Test',
              'User',
              1,
              TEST_TIMESTAMP,
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test3@example.com',
              'Test',
              'User',
              2,
              TEST_TIMESTAMP,
            ],
            [
              {
                id: '2',
              },
              {
                id: '3',
              },
            ]
          );
        });
    });

    it('should allow for using the `asCallback` interface', function (ok) {
      knex('test_table_two')
        .insert(
          [
            {
              account_id: 1,
              details:
                'Lorem ipsum Minim nostrud Excepteur consectetur enim ut qui sint in veniam in nulla anim do cillum sunt voluptate Duis non incididunt.',
              status: 0,
            },
            {
              account_id: 2,
              details:
                'Lorem ipsum Minim nostrud Excepteur consectetur enim ut qui sint in veniam in nulla anim do cillum sunt voluptate Duis non incididunt.',
              status: 1,
            },
            {
              account_id: 3,
              details: '',
              status: 1,
            },
          ],
          'id'
        )
        .testSql(function (tester) {
          tester(
            'oracledb',
            'begin execute immediate \'insert into "test_table_two" ("account_id", "details", "status") values (:1, :2, :3) returning "id" into :4\' using ?, ?, ?, out ?; execute immediate \'insert into "test_table_two" ("account_id", "details", "status") values (:1, :2, :3) returning "id" into :4\' using ?, ?, ?, out ?; execute immediate \'insert into "test_table_two" ("account_id", "details", "status") values (:1, :2, :3) returning "id" into :4\' using ?, ?, ?, out ?;end;',
            [
              1,
              'Lorem ipsum Minim nostrud Excepteur consectetur enim ut qui sint in veniam in nulla anim do cillum sunt voluptate Duis non incididunt.',
              0,
              function (v) {
                return v.toString() === '[object ReturningHelper:id]';
              },
              2,
              'Lorem ipsum Minim nostrud Excepteur consectetur enim ut qui sint in veniam in nulla anim do cillum sunt voluptate Duis non incididunt.',
              1,
              function (v) {
                return v.toString() === '[object ReturningHelper:id]';
              },
              3,
              '',
              1,
              function (v) {
                return v.toString() === '[object ReturningHelper:id]';
              },
            ],
            [{ id: '1' }, { id: '2' }, { id: '3' }]
          );
        })
        .asCallback(function (err) {
          if (err) return ok(err);
          ok();
        });
    });

    it('should take hashes passed into insert and keep them in the correct order', function () {
      return knex('accounts')
        .insert(
          [
            {
              first_name: 'Test',
              last_name: 'User',
              email: 'test4@example.com',
              about: 'Lorem ipsum Dolore labore incididunt enim.',
              logins: 2,
              created_at: TEST_TIMESTAMP,
              updated_at: TEST_TIMESTAMP,
            },
            {
              first_name: 'Test',
              about: 'Lorem ipsum Dolore labore incididunt enim.',
              logins: 2,
              created_at: TEST_TIMESTAMP,
              updated_at: TEST_TIMESTAMP,
              last_name: 'User',
              email: 'test5@example.com',
            },
          ],
          'id'
        )
        .testSql(function (tester) {
          tester(
            'mysql',
            'insert into `accounts` (`about`, `created_at`, `email`, `first_name`, `last_name`, `logins`, `updated_at`) values (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)',
            [
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test4@example.com',
              'Test',
              'User',
              2,
              TEST_TIMESTAMP,
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test5@example.com',
              'Test',
              'User',
              2,
              TEST_TIMESTAMP,
            ],
            [4]
          );
          tester(
            'pg',
            'insert into "accounts" ("about", "created_at", "email", "first_name", "last_name", "logins", "updated_at") values (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?) returning "id"',
            [
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test4@example.com',
              'Test',
              'User',
              2,
              TEST_TIMESTAMP,
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test5@example.com',
              'Test',
              'User',
              2,
              TEST_TIMESTAMP,
            ],
            [{ id: '4' }, { id: '5' }]
          );
          tester(
            'pg-redshift',
            'insert into "accounts" ("about", "created_at", "email", "first_name", "last_name", "logins", "updated_at") values (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)',
            [
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test4@example.com',
              'Test',
              'User',
              2,
              TEST_TIMESTAMP,
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test5@example.com',
              'Test',
              'User',
              2,
              TEST_TIMESTAMP,
            ],
            2
          );
          tester(
            'sqlite3',
            'insert into `accounts` (`about`, `created_at`, `email`, `first_name`, `last_name`, `logins`, `updated_at`) select ? as `about`, ? as `created_at`, ? as `email`, ? as `first_name`, ? as `last_name`, ? as `logins`, ? as `updated_at` union all select ? as `about`, ? as `created_at`, ? as `email`, ? as `first_name`, ? as `last_name`, ? as `logins`, ? as `updated_at`',
            [
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test4@example.com',
              'Test',
              'User',
              2,
              TEST_TIMESTAMP,
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test5@example.com',
              'Test',
              'User',
              2,
              TEST_TIMESTAMP,
            ],
            [5]
          );
          tester(
            'oracledb',
            'begin execute immediate \'insert into "accounts" ("about", "created_at", "email", "first_name", "last_name", "logins", "updated_at") values (:1, :2, :3, :4, :5, :6, :7) returning "id" into :8\' using ?, ?, ?, ?, ?, ?, ?, out ?; execute immediate \'insert into "accounts" ("about", "created_at", "email", "first_name", "last_name", "logins", "updated_at") values (:1, :2, :3, :4, :5, :6, :7) returning "id" into :8\' using ?, ?, ?, ?, ?, ?, ?, out ?;end;',
            [
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test4@example.com',
              'Test',
              'User',
              2,
              TEST_TIMESTAMP,
              function (v) {
                return v.toString() === '[object ReturningHelper:id]';
              },
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test5@example.com',
              'Test',
              'User',
              2,
              TEST_TIMESTAMP,
              function (v) {
                return v.toString() === '[object ReturningHelper:id]';
              },
            ],
            [{ id: '4' }, { id: '5' }]
          );
          tester(
            'mssql',
            'insert into [accounts] ([about], [created_at], [email], [first_name], [last_name], [logins], [updated_at]) output inserted.[id] values (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)',
            [
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test4@example.com',
              'Test',
              'User',
              2,
              TEST_TIMESTAMP,
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test5@example.com',
              'Test',
              'User',
              2,
              TEST_TIMESTAMP,
            ],
            [{ id: '4' }, { id: '5' }]
          );
        });
    });

    it('will fail when multiple inserts are made into a unique column', function () {
      if (isRedshift(knex)) {
        return this.skip();
      }
      return knex('accounts')
        .where('id', '>', 1)
        .orWhere('x', 2)
        .insert(
          {
            first_name: 'Test',
            last_name: 'User',
            email: 'test5@example.com',
            about: 'Lorem ipsum Dolore labore incididunt enim.',
            logins: 2,
            created_at: TEST_TIMESTAMP,
            updated_at: TEST_TIMESTAMP,
          },
          'id'
        )
        .testSql(function (tester) {
          tester(
            'mysql',
            'insert into `accounts` (`about`, `created_at`, `email`, `first_name`, `last_name`, `logins`, `updated_at`) values (?, ?, ?, ?, ?, ?, ?)',
            [
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test5@example.com',
              'Test',
              'User',
              2,
              TEST_TIMESTAMP,
            ]
          );
          tester(
            'pg',
            'insert into "accounts" ("about", "created_at", "email", "first_name", "last_name", "logins", "updated_at") values (?, ?, ?, ?, ?, ?, ?) returning "id"',
            [
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test5@example.com',
              'Test',
              'User',
              2,
              TEST_TIMESTAMP,
            ]
          );
          tester(
            'sqlite3',
            'insert into `accounts` (`about`, `created_at`, `email`, `first_name`, `last_name`, `logins`, `updated_at`) values (?, ?, ?, ?, ?, ?, ?)',
            [
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test5@example.com',
              'Test',
              'User',
              2,
              TEST_TIMESTAMP,
            ]
          );
          tester(
            'oracledb',
            'insert into "accounts" ("about", "created_at", "email", "first_name", "last_name", "logins", "updated_at") values (?, ?, ?, ?, ?, ?, ?) returning "id" into ?',
            [
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test5@example.com',
              'Test',
              'User',
              2,
              TEST_TIMESTAMP,
              function (v) {
                return v.toString() === '[object ReturningHelper:id]';
              },
            ]
          );
          tester(
            'mssql',
            'insert into [accounts] ([about], [created_at], [email], [first_name], [last_name], [logins], [updated_at]) output inserted.[id] values (?, ?, ?, ?, ?, ?, ?)',
            [
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test5@example.com',
              'Test',
              'User',
              2,
              TEST_TIMESTAMP,
            ]
          );
        })
        .then(
          function () {
            throw new Error(
              'There should be a fail when multi-insert are made in unique col.'
            );
          },
          function () {}
        );
    });

    it('should drop any where clause bindings', function () {
      return knex('accounts')
        .where('id', '>', 1)
        .orWhere('x', 2)
        .insert(
          {
            first_name: 'Test',
            last_name: 'User',
            email: 'test6@example.com',
            about: 'Lorem ipsum Dolore labore incididunt enim.',
            logins: 2,
            created_at: TEST_TIMESTAMP,
            updated_at: TEST_TIMESTAMP,
          },
          'id'
        )
        .testSql(function (tester) {
          tester(
            'mysql',
            'insert into `accounts` (`about`, `created_at`, `email`, `first_name`, `last_name`, `logins`, `updated_at`) values (?, ?, ?, ?, ?, ?, ?)',
            [
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test6@example.com',
              'Test',
              'User',
              2,
              TEST_TIMESTAMP,
            ],
            [7]
          );
          tester(
            'pg',
            'insert into "accounts" ("about", "created_at", "email", "first_name", "last_name", "logins", "updated_at") values (?, ?, ?, ?, ?, ?, ?) returning "id"',
            [
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test6@example.com',
              'Test',
              'User',
              2,
              TEST_TIMESTAMP,
            ],
            [{ id: '7' }]
          );
          tester(
            'pg-redshift',
            'insert into "accounts" ("about", "created_at", "email", "first_name", "last_name", "logins", "updated_at") values (?, ?, ?, ?, ?, ?, ?)',
            [
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test6@example.com',
              'Test',
              'User',
              2,
              TEST_TIMESTAMP,
            ],
            1
          );
          tester(
            'sqlite3',
            'insert into `accounts` (`about`, `created_at`, `email`, `first_name`, `last_name`, `logins`, `updated_at`) values (?, ?, ?, ?, ?, ?, ?)',
            [
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test6@example.com',
              'Test',
              'User',
              2,
              TEST_TIMESTAMP,
            ],
            [6]
          );
          tester(
            'oracledb',
            'insert into "accounts" ("about", "created_at", "email", "first_name", "last_name", "logins", "updated_at") values (?, ?, ?, ?, ?, ?, ?) returning "id" into ?',
            [
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test6@example.com',
              'Test',
              'User',
              2,
              TEST_TIMESTAMP,
              function (v) {
                return v.toString() === '[object ReturningHelper:id]';
              },
            ],
            [{ id: '7' }]
          );
          tester(
            'mssql',
            'insert into [accounts] ([about], [created_at], [email], [first_name], [last_name], [logins], [updated_at]) output inserted.[id] values (?, ?, ?, ?, ?, ?, ?)',
            [
              'Lorem ipsum Dolore labore incididunt enim.',
              TEST_TIMESTAMP,
              'test6@example.com',
              'Test',
              'User',
              2,
              TEST_TIMESTAMP,
            ],
            [{ id: '7' }]
          );
        });
    });

    it('should not allow inserting invalid values into enum fields', function () {
      return knex('datatype_test')
        .insert({ enum_value: 'd' })
        .testSql(function (tester) {
          tester(
            'mysql',
            'insert into `datatype_test` (`enum_value`) values (?)',
            ['d']
          );
          tester(
            'pg',
            'insert into "datatype_test" ("enum_value") values (?)',
            ['d']
          );
          tester(
            'pg-redshift',
            'insert into "datatype_test" ("enum_value") values (?)',
            ['d']
          );
          tester(
            'sqlite3',
            'insert into `datatype_test` (`enum_value`) values (?)',
            ['d'],
            [1]
          );
          tester(
            'oracledb',
            'insert into "datatype_test" ("enum_value") values (?)',
            ['d']
          );
          tester(
            'mssql',
            'insert into [datatype_test] ([enum_value]) values (?)',
            ['d']
          );
        })
        .then(
          function () {
            // No errors happen in sqlite3, which doesn't have native support
            // for the enum type.
            if (!isSQLite(knex)) {
              throw new Error(
                'There should be an error for invalid enum inserts'
              );
            }
          },
          function () {}
        );
    });

    it('should not allow invalid uuids in postgresql', function () {
      return knex('datatype_test')
        .insert({
          enum_value: 'c',
          uuid: 'c39d8fcf-68a0-4902-b192-1ebb6310d9ad',
        })
        .then(function () {
          return knex('datatype_test').insert({
            enum_value: 'c',
            uuid: 'test',
          });
        })
        .then(
          function () {
            // No errors happen in sqlite3 or mysql, which don't have native support
            // for the uuid type.
            if (isPostgreSQL(knex) || isMssql(knex)) {
              throw new Error(
                'There should be an error in postgresql for uuids'
              );
            }
          },
          function () {}
        );
    });

    it('should not mutate the array passed in', function () {
      const a = {
        enum_value: 'a',
        uuid: '00419fc1-7eed-442c-9c01-cf757e74b8f0',
      };
      const b = {
        enum_value: 'c',
        uuid: '13ac5acd-c5d7-41a0-8db0-dacf64d0e4e2',
      };
      const x = [a, b];

      return knex('datatype_test')
        .insert(x)
        .then(function () {
          expect(x).to.eql([a, b]);
        });
    });

    it('should throw an error if the array passed in is empty', async function () {
      await expect(knex('account').insert([])).to.be.rejectedWith(
        Error,
        'The query is empty'
      );
    });

    it('should handle empty inserts', function () {
      return knex.schema
        .createTable('test_default_table', function (qb) {
          qb.increments().primary();
          qb.string('string').defaultTo('hello');
          qb.tinyint('tinyint').defaultTo(0);
          qb.text('text').nullable();
        })
        .then(function () {
          return knex('test_default_table')
            .insert({}, 'id')
            .testSql(function (tester) {
              tester(
                'mysql',
                'insert into `test_default_table` () values ()',
                [],
                [1]
              );
              tester(
                'pg',
                'insert into "test_default_table" default values returning "id"',
                [],
                [{ id: 1 }]
              );
              tester(
                'pg-redshift',
                'insert into "test_default_table" default values',
                [],
                1
              );
              tester(
                'sqlite3',
                'insert into `test_default_table` default values',
                [],
                [1]
              );
              tester(
                'oracledb',
                'insert into "test_default_table" ("id") values (default) returning "id" into ?',
                [
                  function (v) {
                    return v.toString() === '[object ReturningHelper:id]';
                  },
                ],
                [{ id: '1' }]
              );
              tester(
                'mssql',
                'insert into [test_default_table] output inserted.[id] default values',
                [],
                [{ id: 1 }]
              );
            });
        });
    });

    it('should handle empty arrays inserts', function () {
      return knex.schema
        .createTable('test_default_table2', function (qb) {
          qb.increments().primary();
          qb.string('string').defaultTo('hello');
          qb.tinyint('tinyint').defaultTo(0);
          qb.text('text').nullable();
        })
        .then(function () {
          return knex('test_default_table2')
            .insert([{}], 'id')
            .testSql(function (tester) {
              tester(
                'mysql',
                'insert into `test_default_table2` () values ()',
                [],
                [1]
              );
              tester(
                'pg',
                'insert into "test_default_table2" default values returning "id"',
                [],
                [{ id: 1 }]
              );
              tester(
                'pg-redshift',
                'insert into "test_default_table2" default values',
                [],
                1
              );
              tester(
                'sqlite3',
                'insert into `test_default_table2` default values',
                [],
                [1]
              );
              tester(
                'oracledb',
                'insert into "test_default_table2" ("id") values (default) returning "id" into ?',
                [
                  function (v) {
                    return v.toString() === '[object ReturningHelper:id]';
                  },
                ],
                [{ id: '1' }]
              );
              tester(
                'mssql',
                'insert into [test_default_table2] output inserted.[id] default values',
                [],
                [{ id: 1 }]
              );
            });
        });
    });

    it('should take an array of columns to return in oracle or postgres', function () {
      const insertData = {
        account_id: 10,
        details:
          'Lorem ipsum Minim nostrud Excepteur consectetur enim ut qui sint in veniam in nulla anim do cillum sunt voluptate Duis non incididunt.',
        status: 0,
      };
      return knex('test_table_two')
        .insert(insertData, ['account_id', 'details'])
        .testSql(function (tester) {
          tester(
            'mysql',
            'insert into `test_table_two` (`account_id`, `details`, `status`) values (?, ?, ?)',
            [
              10,
              'Lorem ipsum Minim nostrud Excepteur consectetur enim ut qui sint in veniam in nulla anim do cillum sunt voluptate Duis non incididunt.',
              0,
            ],
            [4]
          );
          tester(
            'pg',
            'insert into "test_table_two" ("account_id", "details", "status") values (?, ?, ?) returning "account_id", "details"',
            [
              10,
              'Lorem ipsum Minim nostrud Excepteur consectetur enim ut qui sint in veniam in nulla anim do cillum sunt voluptate Duis non incididunt.',
              0,
            ],
            [
              {
                account_id: 10,
                details:
                  'Lorem ipsum Minim nostrud Excepteur consectetur enim ut qui sint in veniam in nulla anim do cillum sunt voluptate Duis non incididunt.',
              },
            ]
          );
          tester(
            'pg-redshift',
            'insert into "test_table_two" ("account_id", "details", "status") values (?, ?, ?)',
            [
              10,
              'Lorem ipsum Minim nostrud Excepteur consectetur enim ut qui sint in veniam in nulla anim do cillum sunt voluptate Duis non incididunt.',
              0,
            ],
            1
          );
          tester(
            'sqlite3',
            'insert into `test_table_two` (`account_id`, `details`, `status`) values (?, ?, ?)',
            [
              10,
              'Lorem ipsum Minim nostrud Excepteur consectetur enim ut qui sint in veniam in nulla anim do cillum sunt voluptate Duis non incididunt.',
              0,
            ],
            [4]
          );
          tester(
            'oracledb',
            `insert into "test_table_two" ("account_id", "details", "status") values (?, ?, ?) returning "account_id","details" into ?,?`,
            [
              10,
              'Lorem ipsum Minim nostrud Excepteur consectetur enim ut qui sint in veniam in nulla anim do cillum sunt voluptate Duis non incididunt.',
              0,
              function (v) {
                return v.toString() === '[object ReturningHelper:account_id]';
              },
              function (v) {
                return v.toString() === '[object ReturningHelper:details]';
              },
            ],
            [
              {
                account_id: '10',
                details:
                  'Lorem ipsum Minim nostrud Excepteur consectetur enim ut qui sint in veniam in nulla anim do cillum sunt voluptate Duis non incididunt.',
              },
            ]
          );
          tester(
            'mssql',
            'insert into [test_table_two] ([account_id], [details], [status]) output inserted.[account_id], inserted.[details] values (?, ?, ?)',
            [
              10,
              'Lorem ipsum Minim nostrud Excepteur consectetur enim ut qui sint in veniam in nulla anim do cillum sunt voluptate Duis non incididunt.',
              0,
            ],
            [
              {
                account_id: 10,
                details:
                  'Lorem ipsum Minim nostrud Excepteur consectetur enim ut qui sint in veniam in nulla anim do cillum sunt voluptate Duis non incididunt.',
              },
            ]
          );
        })
        .then(function (rows) {
          if (isRedshift(knex)) {
            return expect(rows).to.equal(1);
          }
          expect(rows.length).to.equal(1);
          if (isPostgreSQL(knex)) {
            expect(_.keys(rows[0]).length).to.equal(2);
            expect(rows[0].account_id).to.equal(insertData.account_id);
            expect(rows[0].details).to.equal(insertData.details);
          }
        });
    });

    it('should allow a * for returning in postgres and oracle', function () {
      if (isRedshift(knex)) {
        return this.skip();
      }
      const insertData = {
        account_id: 10,
        details:
          'Lorem ipsum Minim nostrud Excepteur consectetur enim ut qui sint in veniam in nulla anim do cillum sunt voluptate Duis non incididunt.',
        status: 0,
      };

      const returningColumn = '*';
      return knex('test_table_two')
        .insert(insertData, returningColumn)
        .testSql(function (tester) {
          tester(
            'pg',
            'insert into "test_table_two" ("account_id", "details", "status") values (?, ?, ?) returning *',
            [
              10,
              'Lorem ipsum Minim nostrud Excepteur consectetur enim ut qui sint in veniam in nulla anim do cillum sunt voluptate Duis non incididunt.',
              0,
            ],
            [
              {
                id: 5,
                account_id: 10,
                details:
                  'Lorem ipsum Minim nostrud Excepteur consectetur enim ut qui sint in veniam in nulla anim do cillum sunt voluptate Duis non incididunt.',
                status: 0,
                json_data: null,
              },
            ]
          );
          tester(
            'oracledb',
            'insert into "test_table_two" ("account_id", "details", "status") values (?, ?, ?) returning "ROWID" into ?',
            [
              10,
              'Lorem ipsum Minim nostrud Excepteur consectetur enim ut qui sint in veniam in nulla anim do cillum sunt voluptate Duis non incididunt.',
              0,
              function (v) {
                return v.toString() === '[object ReturningHelper:ROWID]';
              },
            ],
            [
              {
                id: 5,
                account_id: 10,
                details:
                  'Lorem ipsum Minim nostrud Excepteur consectetur enim ut qui sint in veniam in nulla anim do cillum sunt voluptate Duis non incididunt.',
                status: 0,
                json_data: null,
              },
            ]
          );
          tester(
            'mssql',
            'insert into [test_table_two] ([account_id], [details], [status]) output inserted.* values (?, ?, ?)',
            [
              10,
              'Lorem ipsum Minim nostrud Excepteur consectetur enim ut qui sint in veniam in nulla anim do cillum sunt voluptate Duis non incididunt.',
              0,
            ],
            [
              {
                id: 5,
                account_id: 10,
                details:
                  'Lorem ipsum Minim nostrud Excepteur consectetur enim ut qui sint in veniam in nulla anim do cillum sunt voluptate Duis non incididunt.',
                status: 0,
                json_data: null,
              },
            ]
          );
        })
        .then(function (rows) {
          expect(rows.length).to.equal(1);
          if (isPostgreSQL(knex)) {
            expect(_.keys(rows[0]).length).to.equal(5);
            expect(rows[0].account_id).to.equal(insertData.account_id);
            expect(rows[0].details).to.equal(insertData.details);
            expect(rows[0].status).to.equal(insertData.status);
            expect(rows[0].json_data).to.equal(null);
          }
        });
    });

    describe('batchInsert', function () {
      const fiftyLengthString =
        'rO8F8YrFS6uoivuRiVnwrO8F8YrFS6uoivuRiVnwuoivuRiVnw';
      const items = [];
      const amountOfItems = 100;
      const amountOfColumns = 30;
      for (let i = 0; i < amountOfItems; i++) {
        const item = {};
        for (let x = 0; x < amountOfColumns; x++) {
          item['Col' + x] = fiftyLengthString;
        }
        items.push(item);
      }

      beforeEach(function () {
        return knex.schema.dropTableIfExists('BatchInsert').then(function () {
          return knex.schema.createTable('BatchInsert', function (table) {
            for (let i = 0; i < amountOfColumns; i++) {
              table.string('Col' + i, 50);
            }
          });
        });
      });

      it('#757 - knex.batchInsert(tableName, bulk, chunkSize)', function () {
        this.timeout(30000);
        return knex
          .batchInsert('BatchInsert', items, 30)
          .returning(['Col1', 'Col2'])
          .then(function (result) {
            //Returning only supported by some dialects.
            if (isPostgreSQL(knex) || isOracle(knex)) {
              result.forEach(function (item) {
                expect(item.Col1).to.equal(fiftyLengthString);
                expect(item.Col2).to.equal(fiftyLengthString);
              });
            }
            return knex('BatchInsert').select();
          })
          .then(function (result) {
            const count = result.length;
            expect(count).to.equal(amountOfItems);
          });
      });

      it('#1880 - Duplicate keys in batchInsert should not throw unhandled exception', async function () {
        if (isRedshift(knex)) {
          return this.skip();
        }
        this.timeout(10000);

        const fn = sinon.stub();
        process.on('unhandledRejection', fn);
        await knex.schema
          .dropTableIfExists('batchInsertDuplicateKey')
          .then(function () {
            return knex.schema.createTable(
              'batchInsertDuplicateKey',
              function (table) {
                table.string('col');
                table.primary('col');
              }
            );
          })
          .then(function () {
            const rows = [{ col: 'a' }, { col: 'a' }];
            return knex.batchInsert(
              'batchInsertDuplicateKey',
              rows,
              rows.length
            );
          })
          .then(function () {
            expect.fail('Should not reach this point');
          })
          .catch(function (error) {
            //Should reach this point before timeout of 10s
            expect(error.message.toLowerCase()).to.include(
              'batchinsertduplicatekey'
            );
          });
        expect(fn).have.not.been.called;
        process.removeListener('unhandledRejection', fn);
      });

      it('knex.batchInsert with specified transaction', function () {
        return knex.transaction(function (tr) {
          knex
            .batchInsert('BatchInsert', items, 30)
            .returning(['Col1', 'Col2'])
            .transacting(tr)
            .then(tr.commit)
            .catch(tr.rollback);
        });
      });

      it('transaction.batchInsert using specified transaction', function () {
        return knex.transaction(function (tr) {
          return tr
            .batchInsert('BatchInsert', items, 30)
            .returning(['Col1', 'Col2']);
        });
      });
    });

    it('should validate batchInsert batchSize parameter', function () {
      //Should not throw, batchSize default
      return knex
        .batchInsert('test', [])
        .then(function () {
          //Should throw, null not valid
          return knex.batchInsert('test', [], null);
        })
        .catch(function (error) {
          expect(error.message).to.equal('Invalid chunkSize: null');

          //Should throw, 0 is not a valid chunkSize
          return knex.batchInsert('test', [], 0);
        })
        .catch(function (error) {
          expect(error.message).to.equal('Invalid chunkSize: 0');

          //Also faulty
          return knex.batchInsert('test', [], 'still no good');
        })
        .catch(function (error) {
          expect(error.message).to.equal('Invalid chunkSize: still no good');

          return true;
        });
    });

    it('should replace undefined keys in multi insert with DEFAULT', function () {
      if (isSQLite(knex)) {
        return true;
      }
      return knex('accounts')
        .insert(
          [
            {
              last_name: 'First Item',
              email: 'single-test1@example.com',
              about: 'Lorem ipsum Dolore labore incididunt enim.',
              created_at: new Date(),
              updated_at: new Date(),
            },
            {
              last_name: 'Second Item',
              email: 'double-test1@example.com',
              logins: 2,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
          '*'
        )
        .then(function () {
          return knex('accounts')
            .whereIn('email', [
              'single-test1@example.com',
              'double-test1@example.com',
            ])
            .orderBy('email', 'desc');
        })
        .then(function (results) {
          expect(results[0].logins).to.equal(1);
          expect(results[1].about).to.equal(null);
          // cleanup to prevent needs for too much changes to other tests
          return knex('accounts')
            .delete()
            .whereIn(
              'id',
              results.map(function (row) {
                return row.id;
              })
            );
        });
    });

    it('will silently do nothing when multiple inserts are made into a unique column and ignore is specified', async function () {
      if (isRedshift(knex)) {
        return this.skip();
      }

      // Setup: Create table with unique email column
      await knex.schema.dropTableIfExists('upsert_tests');
      await knex.schema.createTable('upsert_tests', (table) => {
        table.string('name');
        table.string('email');
        table.unique('email');
      });

      // Setup: Create row to conflict against
      await knex('upsert_tests').insert({
        email: 'ignoretest@example.com',
        name: 'BEFORE',
      });

      // Test: Insert..ignore with same email as existing row
      try {
        await knex('upsert_tests')
          .insert({ email: 'ignoretest@example.com', name: 'AFTER' }, 'email')
          .onConflict('email')
          .ignore()
          .testSql(function (tester) {
            tester(
              'mysql',
              'insert ignore into `upsert_tests` (`email`, `name`) values (?, ?)',
              ['ignoretest@example.com', 'AFTER']
            );
            tester(
              'pg',
              'insert into "upsert_tests" ("email", "name") values (?, ?) on conflict ("email") do nothing returning "email"',
              ['ignoretest@example.com', 'AFTER']
            );
            tester(
              'sqlite3',
              'insert into `upsert_tests` (`email`, `name`) values (?, ?) on conflict (`email`) do nothing',
              ['ignoretest@example.com', 'AFTER']
            );
          });
      } catch (err) {
        if (isOracle(knex) || isMssql(knex)) {
          expect(err).to.be.an('error');
          if (err.message.includes('.onConflict() is not supported for'))
            return;
        }
        throw err;
      }

      // Assert: there is still only 1 row, and that it HAS NOT been updated
      const rows = await knex('upsert_tests')
        .where({ email: 'ignoretest@example.com' })
        .select();
      expect(rows.length).to.equal(1);
      expect(rows[0].name).to.equal('BEFORE');
    });

    it('will still silently do nothing when multiple inserts are made into a unique column and ignore is specified with no columns', async function () {
      if (isRedshift(knex)) {
        return this.skip();
      }

      // Setup: Create table with unique email column
      await knex.schema.dropTableIfExists('upsert_tests');
      await knex.schema.createTable('upsert_tests', (table) => {
        table.string('name');
        table.string('email');
        table.unique('email');
      });

      // Setup: Create row to conflict against
      await knex('upsert_tests').insert({
        email: 'ignoretest@example.com',
        name: 'BEFORE',
      });

      // Test: Insert..ignore with same email as existing row
      try {
        await knex('upsert_tests')
          .insert({ email: 'ignoretest@example.com', name: 'AFTER' }, 'email')
          .onConflict()
          .ignore()
          .testSql(function (tester) {
            tester(
              'mysql',
              'insert ignore into `upsert_tests` (`email`, `name`) values (?, ?)',
              ['ignoretest@example.com', 'AFTER']
            );
            tester(
              'pg',
              'insert into "upsert_tests" ("email", "name") values (?, ?) on conflict do nothing returning "email"',
              ['ignoretest@example.com', 'AFTER']
            );
            tester(
              'sqlite3',
              'insert into `upsert_tests` (`email`, `name`) values (?, ?) on conflict do nothing',
              ['ignoretest@example.com', 'AFTER']
            );
          });
      } catch (err) {
        if (isOracle(knex) || isMssql(knex)) {
          expect(err).to.be.an('error');
          if (err.message.includes('.onConflict() is not supported for'))
            return;
        }
        throw err;
      }

      // Assert: there is still only 1 row, and that it HAS NOT been updated
      const rows = await knex('upsert_tests')
        .where({ email: 'ignoretest@example.com' })
        .select();
      expect(rows.length).to.equal(1);
      expect(rows[0].name).to.equal('BEFORE');
    });

    it('will silently do nothing when multiple inserts are made into a composite unique column and ignore is specified', async function () {
      if (isRedshift(knex)) {
        return this.skip();
      }

      // Setup: Create table with unique email column
      await knex.schema.dropTableIfExists('upsert_composite_key_tests');
      await knex.schema.createTable('upsert_composite_key_tests', (table) => {
        table.string('name');
        table.string('email');
        table.string('org');
        table.unique(['org', 'email']);
      });

      // Setup: Create row to conflict against
      await knex('upsert_composite_key_tests').insert({
        org: 'acme-inc',
        email: 'ignoretest@example.com',
        name: 'BEFORE',
      });

      // Test: Insert..ignore with same email as existing row
      try {
        await knex('upsert_composite_key_tests')
          .insert(
            { org: 'acme-inc', email: 'ignoretest@example.com', name: 'AFTER' },
            'email'
          )
          .onConflict(['org', 'email'])
          .ignore()
          .testSql(function (tester) {
            tester(
              'mysql',
              'insert ignore into `upsert_composite_key_tests` (`email`, `name`, `org`) values (?, ?, ?)',
              ['ignoretest@example.com', 'AFTER', 'acme-inc']
            );
            tester(
              'pg',
              'insert into "upsert_composite_key_tests" ("email", "name", "org") values (?, ?, ?) on conflict ("org", "email") do nothing returning "email"',
              ['ignoretest@example.com', 'AFTER', 'acme-inc']
            );
            tester(
              'sqlite3',
              'insert into `upsert_composite_key_tests` (`email`, `name`, `org`) values (?, ?, ?) on conflict (`org`, `email`) do nothing',
              ['ignoretest@example.com', 'AFTER', 'acme-inc']
            );
          });
      } catch (err) {
        if (isOracle(knex) || isMssql(knex)) {
          expect(err).to.be.an('error');
          if (err.message.includes('.onConflict() is not supported for'))
            return;
        }
        throw err;
      }

      // Assert: there is still only 1 row, and that it HAS NOT been updated
      const rows = await knex('upsert_composite_key_tests')
        .where({ email: 'ignoretest@example.com' })
        .select();
      expect(rows.length).to.equal(1);
      expect(rows[0].name).to.equal('BEFORE');
    });

    it('updates columns when inserting a duplicate key to unique column and merge is specified', async function () {
      if (isRedshift(knex)) {
        return this.skip();
      }

      // Setup: Create table with unique email column
      await knex.schema.dropTableIfExists('upsert_tests');
      await knex.schema.createTable('upsert_tests', (table) => {
        table.string('name');
        table.string('email');
        table.unique('email');
      });

      // Setup: Create row to conflict against
      await knex('upsert_tests').insert({
        email: 'mergetest@example.com',
        name: 'BEFORE',
      });

      // Perform insert..merge (upsert)
      try {
        await knex('upsert_tests')
          .insert({ email: 'mergetest@example.com', name: 'AFTER' }, 'email')
          .onConflict('email')
          .merge()
          .testSql(function (tester) {
            tester(
              'mysql',
              'insert into `upsert_tests` (`email`, `name`) values (?, ?) on duplicate key update `email` = values(`email`), `name` = values(`name`)',
              ['mergetest@example.com', 'AFTER']
            );
            tester(
              'pg',
              'insert into "upsert_tests" ("email", "name") values (?, ?) on conflict ("email") do update set "email" = excluded."email", "name" = excluded."name" returning "email"',
              ['mergetest@example.com', 'AFTER']
            );
            tester(
              'sqlite3',
              'insert into `upsert_tests` (`email`, `name`) values (?, ?) on conflict (`email`) do update set `email` = excluded.`email`, `name` = excluded.`name`',
              ['mergetest@example.com', 'AFTER']
            );
          });
      } catch (err) {
        if (isOracle(knex) || isMssql(knex)) {
          expect(err).to.be.an('error');
          if (err.message.includes('.onConflict() is not supported for'))
            return;
        }
        throw err;
      }

      // Check that row HAS been updated
      const rows = await knex('upsert_tests')
        .where({ email: 'mergetest@example.com' })
        .select();
      expect(rows.length).to.equal(1);
      expect(rows[0].name).to.equal('AFTER');
    });

    it('conditionally updates rows when inserting a duplicate key to unique column and merge with where clause matching row(s) is specified', async function () {
      if (isRedshift(knex)) {
        return this.skip();
      }

      // Setup: Create table with unique email column
      await knex.schema.dropTableIfExists('upsert_tests');
      await knex.schema.createTable('upsert_tests', (table) => {
        table.string('name');
        table.string('email');
        table.string('role');
        table.unique('email');
      });

      // Setup: Create row to conflict against
      await knex('upsert_tests').insert({
        email: 'mergetest@example.com',
        role: 'tester',
        name: 'BEFORE',
      });

      // Perform insert..merge (upsert)
      try {
        await knex('upsert_tests')
          .insert({ email: 'mergetest@example.com', name: 'AFTER' }, 'email')
          .onConflict('email')
          .merge()
          .where('upsert_tests.role', 'tester')
          .testSql(function (tester) {
            tester(
              'pg',
              'insert into "upsert_tests" ("email", "name") values (?, ?) on conflict ("email") do update set "email" = excluded."email", "name" = excluded."name" where "upsert_tests"."role" = ? returning "email"',
              ['mergetest@example.com', 'AFTER', 'tester']
            );
            tester(
              'sqlite3',
              'insert into `upsert_tests` (`email`, `name`) values (?, ?) on conflict (`email`) do update set `email` = excluded.`email`, `name` = excluded.`name` where `upsert_tests`.`role` = ?',
              ['mergetest@example.com', 'AFTER', 'tester']
            );
          });
      } catch (err) {
        if (isOracle(knex) || isMssql(knex)) {
          expect(err).to.be.an('error');
          if (err.message.includes('.onConflict() is not supported for'))
            return;
        }
        if (isMysql(knex)) {
          expect(err).to.be.an('error');
          if (
            err.message.includes(
              '.onConflict().merge().where() is not supported for'
            )
          )
            return;
        }
        throw err;
      }

      // Check that row HAS been updated
      const rows = await knex('upsert_tests')
        .where({ email: 'mergetest@example.com' })
        .select();
      expect(rows.length).to.equal(1);
      expect(rows[0].name).to.equal('AFTER');
    });

    it('will silently do nothing when inserting a duplicate key to unique column and merge with where clause matching no rows is specified', async function () {
      if (isRedshift(knex)) {
        return this.skip();
      }

      // Setup: Create table with unique email column
      await knex.schema.dropTableIfExists('upsert_tests');
      await knex.schema.createTable('upsert_tests', (table) => {
        table.string('name');
        table.string('email');
        table.string('role');
        table.unique('email');
      });

      // Setup: Create row to conflict against
      await knex('upsert_tests').insert({
        email: 'mergetest@example.com',
        role: 'tester',
        name: 'BEFORE',
      });

      // Perform insert..merge (upsert)
      try {
        await knex('upsert_tests')
          .insert({ email: 'mergetest@example.com', name: 'AFTER' }, 'email')
          .onConflict('email')
          .merge()
          .where('upsert_tests.role', 'fake-role')
          .testSql(function (tester) {
            tester(
              'pg',
              'insert into "upsert_tests" ("email", "name") values (?, ?) on conflict ("email") do update set "email" = excluded."email", "name" = excluded."name" where "upsert_tests"."role" = ? returning "email"',
              ['mergetest@example.com', 'AFTER', 'fake-role']
            );
            tester(
              'sqlite3',
              'insert into `upsert_tests` (`email`, `name`) values (?, ?) on conflict (`email`) do update set `email` = excluded.`email`, `name` = excluded.`name` where `upsert_tests`.`role` = ?',
              ['mergetest@example.com', 'AFTER', 'fake-role']
            );
          });
      } catch (err) {
        if (isOracle(knex) || isMssql(knex)) {
          expect(err).to.be.an('error');
          if (err.message.includes('.onConflict() is not supported for'))
            return;
        }
        if (isMysql(knex)) {
          expect(err).to.be.an('error');
          if (
            err.message.includes(
              '.onConflict().merge().where() is not supported for'
            )
          )
            return;
        }
        throw err;
      }

      // Check that row HAS NOT been updated
      const rows = await knex('upsert_tests')
        .where({ email: 'mergetest@example.com' })
        .select();
      expect(rows.length).to.equal(1);
      expect(rows[0].name).to.equal('BEFORE');
    });

    it('updates all columns with raw value when inserting a duplicate key to unique column and merge is specified', async function () {
      if (isRedshift(knex)) {
        return this.skip();
      }

      // Setup: Create table with unique email column
      await knex.schema.dropTableIfExists('upsert_tests');
      await knex.schema.createTable('upsert_tests', (table) => {
        table.string('name');
        table.string('email');
        table.unique('email');
      });

      // Setup: Create row to conflict against
      await knex('upsert_tests').insert([
        { email: 'mergesource@example.com', name: 'SOURCE' },
        { email: 'mergedest@example.com', name: 'DEST' },
      ]);

      // Perform insert..merge (upsert)
      try {
        await knex('upsert_tests')
          .insert(
            {
              email: 'mergedest@example.com',
              name: knex.raw(
                "(SELECT name FROM (SELECT * FROM upsert_tests) AS t WHERE email = 'mergesource@example.com')"
              ),
            },
            'email'
          )
          .onConflict('email')
          .merge()
          .testSql(function (tester) {
            tester(
              'mysql',
              "insert into `upsert_tests` (`email`, `name`) values (?, (SELECT name FROM (SELECT * FROM upsert_tests) AS t WHERE email = 'mergesource@example.com')) on duplicate key update `email` = values(`email`), `name` = values(`name`)",
              ['mergedest@example.com']
            );
            tester(
              'pg',
              'insert into "upsert_tests" ("email", "name") values (?, (SELECT name FROM (SELECT * FROM upsert_tests) AS t WHERE email = \'mergesource@example.com\')) on conflict ("email") do update set "email" = excluded."email", "name" = excluded."name" returning "email"',
              ['mergedest@example.com']
            );
            tester(
              'sqlite3',
              "insert into `upsert_tests` (`email`, `name`) values (?, (SELECT name FROM (SELECT * FROM upsert_tests) AS t WHERE email = 'mergesource@example.com')) on conflict (`email`) do update set `email` = excluded.`email`, `name` = excluded.`name`",
              ['mergedest@example.com']
            );
          });
      } catch (err) {
        if (isOracle(knex) || isMssql(knex)) {
          expect(err).to.be.an('error');
          if (err.message.includes('.onConflict() is not supported for'))
            return;
        }
        throw err;
      }

      // Check that row HAS been updated
      const rows = await knex('upsert_tests')
        .where({ email: 'mergedest@example.com' })
        .select();
      expect(rows.length).to.equal(1);
      expect(rows[0].name).to.equal('SOURCE');
    });

    it('updates columns with raw value when inserting a duplicate key to unique column and merge with update data is specified', async function () {
      if (isRedshift(knex)) {
        return this.skip();
      }

      // Setup table for testing knex.raw with
      await knex.schema.dropTableIfExists('upsert_value_source');
      await knex.schema.createTable('upsert_value_source', (table) => {
        table.string('name');
      });
      await knex('upsert_value_source').insert([{ name: 'SOURCE' }]);

      // Setup: Create table with unique email column
      await knex.schema.dropTableIfExists('upsert_tests');
      await knex.schema.createTable('upsert_tests', (table) => {
        table.string('name');
        table.string('email');
        table.unique('email');
      });

      // Setup: Create row to conflict against
      await knex('upsert_tests').insert([
        { email: 'mergedest@example.com', name: 'DEST' },
      ]);

      // Perform insert..merge (upsert)
      try {
        await knex('upsert_tests')
          .insert(
            { email: 'mergedest@example.com', name: 'SHOULD NOT BE USED' },
            'email'
          )
          .onConflict('email')
          .merge({ name: knex.raw('(SELECT name FROM upsert_value_source)') })
          .testSql(function (tester) {
            tester(
              'mysql',
              'insert into `upsert_tests` (`email`, `name`) values (?, ?) on duplicate key update `name` = (SELECT name FROM upsert_value_source)',
              ['mergedest@example.com', 'SHOULD NOT BE USED']
            );
            tester(
              'pg',
              'insert into "upsert_tests" ("email", "name") values (?, ?) on conflict ("email") do update set "name" = (SELECT name FROM upsert_value_source) returning "email"',
              ['mergedest@example.com', 'SHOULD NOT BE USED']
            );
            tester(
              'sqlite3',
              'insert into `upsert_tests` (`email`, `name`) values (?, ?) on conflict (`email`) do update set `name` = (SELECT name FROM upsert_value_source)',
              ['mergedest@example.com', 'SHOULD NOT BE USED']
            );
          });
      } catch (err) {
        if (isOracle(knex) || isMssql(knex)) {
          expect(err).to.be.an('error');
          if (err.message.includes('.onConflict() is not supported for'))
            return;
        }
        throw err;
      }

      // Check that row HAS been updated
      const rows = await knex('upsert_tests')
        .where({ email: 'mergedest@example.com' })
        .select();
      expect(rows.length).to.equal(1);
      expect(rows[0].name).to.equal('SOURCE');
    });

    it('updates specified columns with insert value when inserting a duplicate key to unique column and merge with update columns is specified', async function () {
      if (isRedshift(knex)) {
        return this.skip();
      }

      // Setup table for testing knex.raw with
      await knex.schema.dropTableIfExists('upsert_value_source');
      await knex.schema.createTable('upsert_value_source', (table) => {
        table.string('name');
      });
      await knex('upsert_value_source').insert([{ name: 'SOURCE' }]);

      // Setup: Create table with unique email column
      await knex.schema.dropTableIfExists('upsert_tests');
      await knex.schema.createTable('upsert_tests', (table) => {
        table.string('name');
        table.string('email');
        table.unique('email');
      });

      // Setup: Create row to conflict against
      await knex('upsert_tests').insert([
        { email: 'mergedest@example.com', name: 'DEST' },
      ]);

      // Perform insert..merge (upsert)
      try {
        await knex('upsert_tests')
          .insert(
            { email: 'mergedest@example.com', name: 'SHOULD BE USED' },
            'email'
          )
          .onConflict('email')
          .merge(['name'])
          .testSql(function (tester) {
            tester(
              'mysql',
              'insert into `upsert_tests` (`email`, `name`) values (?, ?) on duplicate key update `name` = values(`name`)',
              ['mergedest@example.com', 'SHOULD BE USED']
            );
            tester(
              'pg',
              'insert into "upsert_tests" ("email", "name") values (?, ?) on conflict ("email") do update set "name" = excluded."name" returning "email"',
              ['mergedest@example.com', 'SHOULD BE USED']
            );
            tester(
              'sqlite3',
              'insert into `upsert_tests` (`email`, `name`) values (?, ?) on conflict (`email`) do update set `name` = excluded.`name`',
              ['mergedest@example.com', 'SHOULD BE USED']
            );
          });
      } catch (err) {
        if (isOracle(knex) || isMssql(knex)) {
          expect(err).to.be.an('error');
          if (err.message.includes('.onConflict() is not supported for'))
            return;
        }
        throw err;
      }

      // Check that row HAS been updated
      const rows = await knex('upsert_tests')
        .where({ email: 'mergedest@example.com' })
        .select();
      expect(rows.length).to.equal(1);
      expect(rows[0].name).to.equal('SHOULD BE USED');
    });

    it('updates and inserts columns when inserting multiple rows merge is specified', async function () {
      if (isRedshift(knex)) {
        return this.skip();
      }

      // Setup: Create table with unique email column
      await knex.schema.dropTableIfExists('upsert_tests');
      await knex.schema.createTable('upsert_tests', (table) => {
        table.string('name');
        table.string('email');
        table.unique('email');
      });

      // Setup: Create row to conflict against
      await knex('upsert_tests').insert([
        { email: 'one@example.com', name: 'BEFORE' },
        { email: 'two@example.com', name: 'BEFORE' },
      ]);

      // Perform insert..merge (upsert)
      try {
        await knex('upsert_tests')
          .insert(
            [
              { email: 'two@example.com', name: 'AFTER' },
              { email: 'three@example.com', name: 'AFTER' },
            ],
            'email'
          )
          .onConflict('email')
          .merge()
          .testSql(function (tester) {
            tester(
              'mysql',
              'insert into `upsert_tests` (`email`, `name`) values (?, ?), (?, ?) on duplicate key update `email` = values(`email`), `name` = values(`name`)',
              ['two@example.com', 'AFTER', 'three@example.com', 'AFTER']
            );
            tester(
              'pg',
              'insert into "upsert_tests" ("email", "name") values (?, ?), (?, ?) on conflict ("email") do update set "email" = excluded."email", "name" = excluded."name" returning "email"',
              ['two@example.com', 'AFTER', 'three@example.com', 'AFTER']
            );
            tester(
              'sqlite3',
              'insert into `upsert_tests` (`email`, `name`) select ? as `email`, ? as `name` union all select ? as `email`, ? as `name` where true on conflict (`email`) do update set `email` = excluded.`email`, `name` = excluded.`name`',
              ['two@example.com', 'AFTER', 'three@example.com', 'AFTER']
            );
          });
      } catch (err) {
        if (isOracle(knex) || isMssql(knex)) {
          expect(err).to.be.an('error');
          if (err.message.includes('.onConflict() is not supported for'))
            return;
        }
        throw err;
      }

      // Check that row HAS been updated
      const rows = await knex('upsert_tests').select();
      expect(rows.length).to.equal(3);

      const row1 = rows.find((row) => row.email === 'one@example.com');
      expect(row1 && row1.name).to.equal('BEFORE');
      const row2 = rows.find((row) => row.email === 'two@example.com');
      expect(row2 && row2.name).to.equal('AFTER');
      const row3 = rows.find((row) => row.email === 'three@example.com');
      expect(row3 && row3.name).to.equal('AFTER');
    });

    it('#1423 should replace undefined keys in single insert with DEFAULT also in transacting query', function () {
      if (isSQLite(knex)) {
        return true;
      }
      return knex.transaction(function (trx) {
        return trx('accounts')
          .insert({
            last_name: 'First Item',
            email: 'findme@example.com',
            logins: undefined,
            about: 'Lorem ipsum Dolore labore incididunt enim.',
            created_at: new Date(),
            updated_at: new Date(),
          })
          .then(function (results) {
            return trx('accounts').where('email', 'findme@example.com');
          })
          .then(function (results) {
            expect(results[0].logins).to.equal(1);
            // cleanup to prevent needs for too much changes to other tests
            return trx('accounts').delete().where('id', results[0].id);
          });
      });
    });
  });
};
