'use strict';

const { expect } = require('chai');

const assert = require('assert');
const Runner = require('../../../lib/execution/runner');

const { TEST_TIMESTAMP } = require('../../util/constants');
const {
  isMysql,
  isPostgreSQL,
  isPgNative,
  isMssql,
  isSQLite,
  isOracle,
} = require('../../util/db-helpers');

module.exports = function (knex) {
  describe('Selects', function () {
    it('runs with no conditions', function () {
      return knex('accounts').select();
    });

    it('returns an array of a single column with `pluck`', function () {
      return knex
        .pluck('id')
        .orderBy('id')
        .from('accounts')
        .testSql(function (tester) {
          tester(
            'mysql',
            'select `id` from `accounts` order by `id` asc',
            [],
            [1, 2, 3, 4, 5, 7]
          );
          tester(
            'pg',
            'select "id" from "accounts" order by "id" asc',
            [],
            ['1', '2', '3', '4', '5', '7']
          );
          tester(
            'pgnative',
            'select "id" from "accounts" order by "id" asc',
            [],
            ['1', '2', '3', '4', '5', '7']
          );
          tester(
            'pg-redshift',
            'select "id" from "accounts" order by "id" asc',
            [],
            ['1', '2', '3', '4', '5', '6']
          );
          tester(
            'sqlite3',
            'select `id` from `accounts` order by `id` asc',
            [],
            [1, 2, 3, 4, 5, 6]
          );
          tester(
            'oracledb',
            'select "id" from "accounts" order by "id" asc',
            [],
            [1, 2, 3, 4, 5, 7]
          );
          tester(
            'mssql',
            'select [id] from [accounts] order by [id] asc',
            [],
            ['1', '2', '3', '4', '5', '7']
          );
        });
    });

    it('can pluck a qualified column name, #1619', function () {
      return knex
        .pluck('accounts.id')
        .from('accounts')
        .orderBy('accounts.id')
        .testSql(function (tester) {
          tester(
            'mysql',
            'select `accounts`.`id` from `accounts` order by `accounts`.`id` asc',
            [],
            [1, 2, 3, 4, 5, 7]
          );
          tester(
            'pg',
            'select "accounts"."id" from "accounts" order by "accounts"."id" asc',
            [],
            ['1', '2', '3', '4', '5', '7']
          );
          tester(
            'pgnative',
            'select "accounts"."id" from "accounts" order by "accounts"."id" asc',
            [],
            ['1', '2', '3', '4', '5', '7']
          );
          tester(
            'pg-redshift',
            'select "accounts"."id" from "accounts" order by "accounts"."id" asc',
            [],
            ['1', '2', '3', '4', '5', '6']
          );
          tester(
            'sqlite3',
            'select `accounts`.`id` from `accounts` order by `accounts`.`id` asc',
            [],
            [1, 2, 3, 4, 5, 6]
          );
          tester(
            'oracledb',
            'select "accounts"."id" from "accounts" order by "accounts"."id" asc',
            [],
            [1, 2, 3, 4, 5, 7]
          );
          tester(
            'mssql',
            'select [accounts].[id] from [accounts] order by [accounts].[id] asc',
            [],
            ['1', '2', '3', '4', '5', '7']
          );
        });
    });

    it('starts selecting at offset', function () {
      return knex
        .pluck('id')
        .orderBy('id')
        .from('accounts')
        .offset(2)
        .testSql(function (tester) {
          tester(
            'mysql',
            'select `id` from `accounts` order by `id` asc limit 18446744073709551615 offset ?',
            [2],
            [3, 4, 5, 7]
          );
          tester(
            'pg',
            'select "id" from "accounts" order by "id" asc offset ?',
            [2],
            ['3', '4', '5', '7']
          );
          tester(
            'pgnative',
            'select "id" from "accounts" order by "id" asc offset ?',
            [2],
            ['3', '4', '5', '7']
          );
          tester(
            'pg-redshift',
            'select "id" from "accounts" order by "id" asc offset ?',
            [2],
            ['3', '4', '5', '6']
          );
          tester(
            'sqlite3',
            'select `id` from `accounts` order by `id` asc limit ? offset ?',
            [-1, 2],
            [3, 4, 5, 6]
          );
          tester(
            'oracledb',
            'select * from (select row_.*, ROWNUM rownum_ from (select "id" from "accounts" order by "id" asc) row_ where rownum <= ?) where rownum_ > ?',
            [10000000000002, 2],
            [3, 4, 5, 7]
          );
          tester(
            'mssql',
            'select [id] from [accounts] order by [id] asc offset ? rows',
            [2],
            ['3', '4', '5', '7']
          );
        });
    });

    it('#4335 - should throw an error when negative offset provided', function (ok) {
      try {
        knex.from('accounts').limit(20).offset(-20);
        throw new Error('no error was thrown for negative offset!');
      } catch (error) {
        if (
          error.message === 'A non-negative integer must be provided to offset.'
        ) {
          ok();
        } else {
          throw error;
        }
      }
    });

    it('#4199 - adheres to hint comments', async function () {
      const expectedErrors = {
        mysql: {
          code: 'ER_QUERY_TIMEOUT',
          errno: 3024,
          sqlMessage:
            'Query execution was interrupted, maximum statement execution time exceeded',
        },
        mysql2: {
          errno: 3024,
          sqlMessage:
            'Query execution was interrupted, maximum statement execution time exceeded',
        },
      };
      if (!expectedErrors[knex.client.driverName]) {
        return this.skip();
      }
      const baseQuery = knex('accounts')
        .select('id', knex.raw('sleep(0.1)'))
        .limit(2);
      await expect(
        baseQuery.clone()
      ).to.eventually.be.fulfilled.and.to.have.lengthOf(2);
      await expect(
        baseQuery.clone().hintComment('max_execution_time(10)')
      ).to.eventually.be.rejected.and.to.deep.include(
        expectedErrors[knex.client.driverName]
      );
    });

    it('#4199 - ignores invalid hint comments', async function () {
      return knex
        .select('id')
        .orderBy('id')
        .from('accounts')
        .hintComment('invalid()')
        .testSql(function (tester) {
          tester(
            'mysql',
            'select /*+ invalid() */ `id` from `accounts` order by `id` asc',
            [],
            [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 7 }]
          );
          tester(
            'pg',
            'select /*+ invalid() */ "id" from "accounts" order by "id" asc',
            [],
            [
              { id: '1' },
              { id: '2' },
              { id: '3' },
              { id: '4' },
              { id: '5' },
              { id: '7' },
            ]
          );
          tester(
            'pgnative',
            'select /*+ invalid() */ "id" from "accounts" order by "id" asc',
            [],
            [
              { id: '1' },
              { id: '2' },
              { id: '3' },
              { id: '4' },
              { id: '5' },
              { id: '7' },
            ]
          );
          tester(
            'pg-redshift',
            'select /*+ invalid() */ "id" from "accounts" order by "id" asc',
            [],
            [
              { id: '1' },
              { id: '2' },
              { id: '3' },
              { id: '4' },
              { id: '5' },
              { id: '6' },
            ]
          );
          tester(
            'sqlite3',
            'select /*+ invalid() */ `id` from `accounts` order by `id` asc',
            [],
            [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }]
          );
          tester(
            'oracledb',
            'select /*+ invalid() */ "id" from "accounts" order by "id" asc',
            [],
            [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 7 }]
          );
          tester(
            'mssql',
            'select /*+ invalid() */ [id] from [accounts] order by [id] asc',
            [],
            [
              { id: '1' },
              { id: '2' },
              { id: '3' },
              { id: '4' },
              { id: '5' },
              { id: '7' },
            ]
          );
        });
    });

    it('returns a single entry with first', function () {
      return knex
        .first('id', 'first_name')
        .orderBy('id')
        .from('accounts')
        .testSql(function (tester) {
          tester(
            'mysql',
            'select `id`, `first_name` from `accounts` order by `id` asc limit ?',
            [1],
            { id: 1, first_name: 'Test' }
          );
          tester(
            'pg',
            'select "id", "first_name" from "accounts" order by "id" asc limit ?',
            [1],
            { id: '1', first_name: 'Test' }
          );
          tester(
            'pgnative',
            'select "id", "first_name" from "accounts" order by "id" asc limit ?',
            [1],
            { id: '1', first_name: 'Test' }
          );
          tester(
            'pg-redshift',
            'select "id", "first_name" from "accounts" order by "id" asc limit ?',
            [1],
            { id: '1', first_name: 'Test' }
          );
          tester(
            'sqlite3',
            'select `id`, `first_name` from `accounts` order by `id` asc limit ?',
            [1],
            { id: 1, first_name: 'Test' }
          );
          tester(
            'oracledb',
            'select * from (select "id", "first_name" from "accounts" order by "id" asc) where rownum <= ?',
            [1],
            { id: 1, first_name: 'Test' }
          );
          tester(
            'mssql',
            'select top (?) [id], [first_name] from [accounts] order by [id] asc',
            [1],
            { id: '1', first_name: 'Test' }
          );
        });
    });

    it('allows you to stream', function () {
      if (isPgNative(knex)) {
        return this.skip();
      }
      let count = 0;
      return knex('accounts')
        .stream(function (rowStream) {
          rowStream.on('data', function () {
            count++;
          });
        })
        .then(function () {
          assert(count === 6, 'Six rows should have been streamed');
        });
    });

    it('returns a stream if not passed a function', function (done) {
      if (isPgNative(knex)) {
        return this.skip();
      }

      let count = 0;
      const stream = knex('accounts').stream();
      stream.on('data', function () {
        count++;
        if (count === 6) done();
      });
    });

    it('allows you to stream with mysql dialect options', function () {
      if (!isMysql(knex)) {
        return this.skip();
      }
      const rows = [];
      return knex('accounts')
        .options({
          typeCast(field, next) {
            let val;
            if (field.type === 'VAR_STRING') {
              val = field.string();
              return val == null ? val : val.toUpperCase();
            }
            return next();
          },
        })
        .stream(function (rowStream) {
          rowStream.on('data', function (row) {
            rows.push(row);
          });
        })
        .then(function () {
          expect(rows).to.have.lengthOf(6);
          rows.forEach((row) => {
            ['first_name', 'last_name', 'email'].forEach((field) =>
              expect(row[field]).to.equal(row[field].toUpperCase())
            );
          });
        });
    });

    it('emits error on the stream, if not passed a function, and connecting fails', function () {
      const expected = new Error();
      const original = Runner.prototype.ensureConnection;
      Runner.prototype.ensureConnection = function () {
        return Promise.reject(expected);
      };

      const restore = () => {
        Runner.prototype.ensureConnection = original;
      };

      const promise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout'));
        }, 5000);

        const stream = knex('accounts').stream();
        stream.on('error', function (actual) {
          clearTimeout(timeout);

          if (actual === expected) {
            resolve();
          } else {
            reject(new Error('Stream emitted unexpected error'));
          }
        });
      });

      promise.then(restore, restore);
      return promise;
    });

    it('emits error on the stream, if not passed a function, and query fails', function (done) {
      const stream = knex('accounts').select('invalid_field').stream();
      stream.on('error', function (err) {
        assert(err instanceof Error);
        done();
      });
    });

    it('emits error if not passed a function and the query has wrong bindings', function (done) {
      const stream = knex('accounts')
        .whereRaw('id = ? and first_name = ?', ['2'])
        .stream();
      stream.on('error', function (err) {
        assert(err instanceof Error);
        done();
      });
    });

    it('properly escapes postgres queries on streaming', function () {
      let count = 0;
      return knex('accounts')
        .where('id', 1)
        .stream(function (rowStream) {
          rowStream.on('data', function () {
            count++;
          });
        })
        .then(function () {
          assert(count === 1, 'One row should have been streamed');
        });
    });

    it('throws errors on the asCallback if uncaught in the last block', function (ok) {
      const listeners = process.listeners('uncaughtException');

      process.removeAllListeners('uncaughtException');

      process.on('uncaughtException', function () {
        process.removeAllListeners('uncaughtException');
        for (let i = 0, l = listeners.length; i < l; i++) {
          process.on('uncaughtException', listeners[i]);
        }
        ok();
      });

      knex('accounts')
        .select()
        .asCallback(function () {
          this.undefinedVar.test;
        });
    });

    it('uses `orderBy`', function () {
      return knex('accounts')
        .pluck('id')
        .orderBy('id', 'desc')
        .testSql(function (tester) {
          tester(
            'oracledb',
            'select "id" from "accounts" order by "id" desc',
            [],
            [7, 5, 4, 3, 2, 1]
          );
          tester(
            'mssql',
            'select [id] from [accounts] order by [id] desc',
            [],
            ['7', '5', '4', '3', '2', '1']
          );
        });
    });

    describe('simple "where" cases', function () {
      it('allows key, value', function () {
        return knex('accounts')
          .where('id', 1)
          .select('first_name', 'last_name')
          .testSql(function (tester) {
            tester(
              'mysql',
              'select `first_name`, `last_name` from `accounts` where `id` = ?',
              [1],
              [
                {
                  first_name: 'Test',
                  last_name: 'User',
                },
              ]
            );
            tester(
              'pg',
              'select "first_name", "last_name" from "accounts" where "id" = ?',
              [1],
              [
                {
                  first_name: 'Test',
                  last_name: 'User',
                },
              ]
            );
            tester(
              'pgnative',
              'select "first_name", "last_name" from "accounts" where "id" = ?',
              [1],
              [
                {
                  first_name: 'Test',
                  last_name: 'User',
                },
              ]
            );
            tester(
              'pg-redshift',
              'select "first_name", "last_name" from "accounts" where "id" = ?',
              [1],
              [
                {
                  first_name: 'Test',
                  last_name: 'User',
                },
              ]
            );
            tester(
              'sqlite3',
              'select `first_name`, `last_name` from `accounts` where `id` = ?',
              [1],
              [
                {
                  first_name: 'Test',
                  last_name: 'User',
                },
              ]
            );
            tester(
              'oracledb',
              'select "first_name", "last_name" from "accounts" where "id" = ?',
              [1],
              [
                {
                  first_name: 'Test',
                  last_name: 'User',
                },
              ]
            );
            tester(
              'mssql',
              'select [first_name], [last_name] from [accounts] where [id] = ?',
              [1],
              [
                {
                  first_name: 'Test',
                  last_name: 'User',
                },
              ]
            );
          });
      });

      it('allows key, operator, value', function () {
        return knex('accounts')
          .where('id', 1)
          .select('first_name', 'last_name')
          .testSql(function (tester) {
            tester(
              'mysql',
              'select `first_name`, `last_name` from `accounts` where `id` = ?',
              [1],
              [
                {
                  first_name: 'Test',
                  last_name: 'User',
                },
              ]
            );
            tester(
              'pg',
              'select "first_name", "last_name" from "accounts" where "id" = ?',
              [1],
              [
                {
                  first_name: 'Test',
                  last_name: 'User',
                },
              ]
            );
            tester(
              'pgnative',
              'select "first_name", "last_name" from "accounts" where "id" = ?',
              [1],
              [
                {
                  first_name: 'Test',
                  last_name: 'User',
                },
              ]
            );
            tester(
              'pg-redshift',
              'select "first_name", "last_name" from "accounts" where "id" = ?',
              [1],
              [
                {
                  first_name: 'Test',
                  last_name: 'User',
                },
              ]
            );
            tester(
              'sqlite3',
              'select `first_name`, `last_name` from `accounts` where `id` = ?',
              [1],
              [
                {
                  first_name: 'Test',
                  last_name: 'User',
                },
              ]
            );
            tester(
              'oracledb',
              'select "first_name", "last_name" from "accounts" where "id" = ?',
              [1],
              [
                {
                  first_name: 'Test',
                  last_name: 'User',
                },
              ]
            );
            tester(
              'mssql',
              'select [first_name], [last_name] from [accounts] where [id] = ?',
              [1],
              [
                {
                  first_name: 'Test',
                  last_name: 'User',
                },
              ]
            );
          });
      });

      it('allows selecting columns with an array', function () {
        return knex('accounts')
          .where('id', '>', 1)
          .select(['email', 'logins'])
          .testSql(function (tester) {
            tester(
              'mysql',
              'select `email`, `logins` from `accounts` where `id` > ?',
              [1]
            );
            tester(
              'pg',
              'select "email", "logins" from "accounts" where "id" > ?',
              [1]
            );
            tester(
              'pgnative',
              'select "email", "logins" from "accounts" where "id" > ?',
              [1]
            );
            tester(
              'pg-redshift',
              'select "email", "logins" from "accounts" where "id" > ?',
              [1]
            );
            tester(
              'sqlite3',
              'select `email`, `logins` from `accounts` where `id` > ?',
              [1]
            );
            tester(
              'oracledb',
              'select "email", "logins" from "accounts" where "id" > ?',
              [1]
            );
            tester(
              'mssql',
              'select [email], [logins] from [accounts] where [id] > ?',
              [1]
            );
          });
      });

      it('allows a hash of where attrs', function () {
        return knex('accounts')
          .where({ id: 1 })
          .select('*')
          .testSql(function (tester) {
            tester(
              'mysql',
              'select * from `accounts` where `id` = ?',
              [1],
              [
                {
                  id: 1,
                  first_name: 'Test',
                  last_name: 'User',
                  email: 'test@example.com',
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
              'pg',
              'select * from "accounts" where "id" = ?',
              [1],
              [
                {
                  id: '1',
                  first_name: 'Test',
                  last_name: 'User',
                  email: 'test@example.com',
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
              'pgnative',
              'select * from "accounts" where "id" = ?',
              [1],
              [
                {
                  id: '1',
                  first_name: 'Test',
                  last_name: 'User',
                  email: 'test@example.com',
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
              'select * from "accounts" where "id" = ?',
              [1],
              [
                {
                  id: '1',
                  first_name: 'Test',
                  last_name: 'User',
                  email: 'test@example.com',
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
              'sqlite3',
              'select * from `accounts` where `id` = ?',
              [1],
              [
                {
                  id: 1,
                  first_name: 'Test',
                  last_name: 'User',
                  email: 'test@example.com',
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
              'oracledb',
              'select * from "accounts" where "id" = ?',
              [1],
              [
                {
                  id: 1,
                  first_name: 'Test',
                  last_name: 'User',
                  email: 'test@example.com',
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
              'mssql',
              'select * from [accounts] where [id] = ?',
              [1],
              [
                {
                  id: '1',
                  first_name: 'Test',
                  last_name: 'User',
                  email: 'test@example.com',
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

      it('allows where id: undefined or id: null as a where null clause', function () {
        return knex('accounts')
          .where({ id: null })
          .select('first_name', 'email')
          .testSql(function (tester) {
            tester(
              'mysql',
              'select `first_name`, `email` from `accounts` where `id` is null',
              [],
              []
            );
            tester(
              'pg',
              'select "first_name", "email" from "accounts" where "id" is null',
              [],
              []
            );
            tester(
              'pgnative',
              'select "first_name", "email" from "accounts" where "id" is null',
              [],
              []
            );
            tester(
              'pg-redshift',
              'select "first_name", "email" from "accounts" where "id" is null',
              [],
              []
            );
            tester(
              'sqlite3',
              'select `first_name`, `email` from `accounts` where `id` is null',
              [],
              []
            );
            tester(
              'oracledb',
              'select "first_name", "email" from "accounts" where "id" is null',
              [],
              []
            );
            tester(
              'mssql',
              'select [first_name], [email] from [accounts] where [id] is null',
              [],
              []
            );
          });
      });

      it('allows where id = 0', function () {
        return knex('accounts')
          .where({ id: 0 })
          .select()
          .testSql(function (tester) {
            tester('mysql', 'select * from `accounts` where `id` = ?', [0], []);
            tester('pg', 'select * from "accounts" where "id" = ?', [0], []);
            tester(
              'pgnative',
              'select * from "accounts" where "id" = ?',
              [0],
              []
            );
            tester(
              'pg-redshift',
              'select * from "accounts" where "id" = ?',
              [0],
              []
            );
            tester(
              'sqlite3',
              'select * from `accounts` where `id` = ?',
              [0],
              []
            );
            tester(
              'oracledb',
              'select * from "accounts" where "id" = ?',
              [0],
              []
            );
            tester('mssql', 'select * from [accounts] where [id] = ?', [0], []);
          });
      });
    });

    it('#1276 - Dates NULL should be returned as NULL, not as new Date(null)', function () {
      return knex.schema
        .dropTableIfExists('DatesTest')
        .createTable('DatesTest', function (table) {
          table.increments('id').primary();
          table.dateTime('dateTimeCol');
          table.timestamp('timeStampCol').nullable().defaultTo(null); // MySQL defaults TIMESTAMP columns to current timestamp
          table.date('dateCol');
          table.time('timeCol');
        })
        .then(function () {
          return knex('DatesTest').insert([
            {
              dateTimeCol: null,
              timeStampCol: null,
              dateCol: null,
              timeCol: null,
            },
          ]);
        })
        .then(function () {
          return knex('DatesTest').select();
        })
        .then(function (rows) {
          expect(rows[0].dateTimeCol).to.equal(null);
          expect(rows[0].timeStampCol).to.equal(null);
          expect(rows[0].dateCol).to.equal(null);
          expect(rows[0].timeCol).to.equal(null);
        });
    });

    it('has a "distinct" clause', function () {
      return Promise.all([
        knex('accounts')
          .select()
          .distinct('email')
          .where('logins', 2)
          .orderBy('email'),
        knex('accounts').distinct('email').select().orderBy('email'),
      ]);
    });

    it('supports "distinct on"', async function () {
      const builder = knex('accounts')
        .select('email', 'logins')
        .distinctOn('id')
        .orderBy('id');
      if (!isPostgreSQL(knex)) {
        let error;
        try {
          await builder;
        } catch (e) {
          error = e;
        }
        expect(error.message).to.eql(
          '.distinctOn() is currently only supported on PostgreSQL'
        );
        return;
      }
      return builder.testSql(function (tester) {
        tester(
          'pg',
          'select distinct on ("id") "email", "logins" from "accounts" order by "id" asc',
          [],
          [
            {
              email: 'test@example.com',
              logins: 1,
            },
            {
              email: 'test2@example.com',
              logins: 1,
            },
            {
              email: 'test3@example.com',
              logins: 2,
            },
            {
              email: 'test4@example.com',
              logins: 2,
            },
            {
              email: 'test5@example.com',
              logins: 2,
            },
            {
              email: 'test6@example.com',
              logins: 2,
            },
          ]
        );
        tester(
          'pgnative',
          'select distinct on ("id") "email", "logins" from "accounts" order by "id" asc',
          [],
          [
            {
              email: 'test@example.com',
              logins: 1,
            },
            {
              email: 'test2@example.com',
              logins: 1,
            },
            {
              email: 'test3@example.com',
              logins: 2,
            },
            {
              email: 'test4@example.com',
              logins: 2,
            },
            {
              email: 'test5@example.com',
              logins: 2,
            },
            {
              email: 'test6@example.com',
              logins: 2,
            },
          ]
        );
      });
    });

    it('does "orWhere" cases', function () {
      return knex('accounts')
        .where('id', 1)
        .orWhere('id', '>', 2)
        .select('first_name', 'last_name');
    });

    it('does "andWhere" cases', function () {
      return knex('accounts')
        .select('first_name', 'last_name', 'about')
        .where('id', 1)
        .andWhere('email', 'test@example.com');
    });

    it('takes a function to wrap nested where statements', function () {
      return Promise.all([
        knex('accounts')
          .where(function () {
            this.where('id', 2);
            this.orWhere('id', 3);
          })
          .select('*'),
      ]);
    });

    it('handles "where in" cases', function () {
      return Promise.all([knex('accounts').whereIn('id', [1, 2, 3]).select()]);
    });

    it('handles "or where in" cases', function () {
      return knex('accounts')
        .where('email', 'test@example.com')
        .orWhereIn('id', [2, 3, 4])
        .select();
    });

    it('handles multi-column "where in" cases', function () {
      if (!isMssql(knex)) {
        return knex('composite_key_test')
          .whereIn(
            ['column_a', 'column_b'],
            [
              [1, 1],
              [1, 2],
            ]
          )
          .orderBy('status', 'desc')
          .select()
          .testSql(function (tester) {
            tester(
              'mysql',
              'select * from `composite_key_test` where (`column_a`, `column_b`) in ((?, ?), (?, ?)) order by `status` desc',
              [1, 1, 1, 2],
              [
                {
                  column_a: 1,
                  column_b: 1,
                  details: 'One, One, One',
                  status: 1,
                },
                {
                  column_a: 1,
                  column_b: 2,
                  details: 'One, Two, Zero',
                  status: 0,
                },
              ]
            );
            tester(
              'pg',
              'select * from "composite_key_test" where ("column_a", "column_b") in ((?, ?), (?, ?)) order by "status" desc',
              [1, 1, 1, 2],
              [
                {
                  column_a: 1,
                  column_b: 1,
                  details: 'One, One, One',
                  status: 1,
                },
                {
                  column_a: 1,
                  column_b: 2,
                  details: 'One, Two, Zero',
                  status: 0,
                },
              ]
            );
            tester(
              'pgnative',
              'select * from "composite_key_test" where ("column_a", "column_b") in ((?, ?), (?, ?)) order by "status" desc',
              [1, 1, 1, 2],
              [
                {
                  column_a: 1,
                  column_b: 1,
                  details: 'One, One, One',
                  status: 1,
                },
                {
                  column_a: 1,
                  column_b: 2,
                  details: 'One, Two, Zero',
                  status: 0,
                },
              ]
            );
            tester(
              'pg-redshift',
              'select * from "composite_key_test" where ("column_a", "column_b") in ((?, ?), (?, ?)) order by "status" desc',
              [1, 1, 1, 2],
              [
                {
                  column_a: 1,
                  column_b: 1,
                  details: 'One, One, One',
                  status: 1,
                },
                {
                  column_a: 1,
                  column_b: 2,
                  details: 'One, Two, Zero',
                  status: 0,
                },
              ]
            );
            tester(
              'oracledb',
              'select * from "composite_key_test" where ("column_a", "column_b") in ((?, ?), (?, ?)) order by "status" desc',
              [1, 1, 1, 2],
              [
                {
                  column_a: 1,
                  column_b: 1,
                  details: 'One, One, One',
                  status: 1,
                },
                {
                  column_a: 1,
                  column_b: 2,
                  details: 'One, Two, Zero',
                  status: 0,
                },
              ]
            );
            tester(
              'sqlite3',
              'select * from `composite_key_test` where (`column_a`, `column_b`) in ( values (?, ?), (?, ?)) order by `status` desc',
              [1, 1, 1, 2],
              [
                {
                  column_a: 1,
                  column_b: 1,
                  details: 'One, One, One',
                  status: 1,
                },
                {
                  column_a: 1,
                  column_b: 2,
                  details: 'One, Two, Zero',
                  status: 0,
                },
              ]
            );
          });
      }
    });

    it('handles multi-column "where in" cases with where', function () {
      if (!isSQLite(knex) && !isMssql(knex)) {
        return knex('composite_key_test')
          .where('status', 1)
          .whereIn(
            ['column_a', 'column_b'],
            [
              [1, 1],
              [1, 2],
            ]
          )
          .select()
          .testSql(function (tester) {
            tester(
              'mysql',
              'select * from `composite_key_test` where `status` = ? and (`column_a`, `column_b`) in ((?, ?), (?, ?))',
              [1, 1, 1, 1, 2],
              [
                {
                  column_a: 1,
                  column_b: 1,
                  details: 'One, One, One',
                  status: 1,
                },
              ]
            );
            tester(
              'pg',
              'select * from "composite_key_test" where "status" = ? and ("column_a", "column_b") in ((?, ?), (?, ?))',
              [1, 1, 1, 1, 2],
              [
                {
                  column_a: 1,
                  column_b: 1,
                  details: 'One, One, One',
                  status: 1,
                },
              ]
            );
            tester(
              'pgnative',
              'select * from "composite_key_test" where "status" = ? and ("column_a", "column_b") in ((?, ?), (?, ?))',
              [1, 1, 1, 1, 2],
              [
                {
                  column_a: 1,
                  column_b: 1,
                  details: 'One, One, One',
                  status: 1,
                },
              ]
            );
            tester(
              'pg-redshift',
              'select * from "composite_key_test" where "status" = ? and ("column_a", "column_b") in ((?, ?), (?, ?))',
              [1, 1, 1, 1, 2],
              [
                {
                  column_a: 1,
                  column_b: 1,
                  details: 'One, One, One',
                  status: 1,
                },
              ]
            );
            tester(
              'oracledb',
              'select * from "composite_key_test" where "status" = ? and ("column_a", "column_b") in ((?, ?), (?, ?))',
              [1, 1, 1, 1, 2],
              [
                {
                  column_a: 1,
                  column_b: 1,
                  details: 'One, One, One',
                  status: 1,
                },
              ]
            );
          });
      }
    });

    it('handles "where exists"', function () {
      return knex('accounts')
        .whereExists(function () {
          this.select('id').from('test_table_two').where({ id: 1 });
        })
        .select();
    });

    it('handles "where between"', function () {
      return knex('accounts').whereBetween('id', [1, 100]).select();
    });

    it('handles "or where between"', function () {
      return knex('accounts')
        .whereBetween('id', [1, 100])
        .orWhereBetween('id', [200, 300])
        .select();
    });

    it('does where(raw)', function () {
      if (isOracle(knex)) {
        // special case for oracle
        return knex('accounts')
          .whereExists(function () {
            this.select(knex.raw(1))
              .from('test_table_two')
              .where(
                knex.raw('"test_table_two"."account_id" = "accounts"."id"')
              );
          })
          .select();
      } else {
        return knex('accounts')
          .whereExists(function () {
            this.select(knex.raw(1))
              .from('test_table_two')
              .where(knex.raw('test_table_two.account_id = accounts.id'));
          })
          .select();
      }
    });

    it('does sub-selects', function () {
      return knex('accounts')
        .whereIn('id', function () {
          this.select('account_id').from('test_table_two').where('status', 1);
        })
        .select('first_name', 'last_name');
    });

    it('supports the <> operator', function () {
      return knex('accounts').where('id', '<>', 2).select('email', 'logins');
    });

    it('Allows for knex.Raw passed to the `where` clause', function () {
      if (isOracle(knex)) {
        return knex('accounts')
          .where(knex.raw('"id" = 2'))
          .select('email', 'logins');
      } else {
        return knex('accounts')
          .where(knex.raw('id = 2'))
          .select('email', 'logins');
      }
    });

    it('Retains array bindings, #228', function () {
      const raw = knex.raw(
        'select * from table t where t.id = ANY( ?::int[] )',
        [[1, 2, 3]]
      );
      const raw2 = knex.raw('select "stored_procedure"(?, ?, ?)', [
        1,
        2,
        ['a', 'b', 'c'],
      ]);
      const expected1 = [[1, 2, 3]];
      const expected2 = [1, 2, ['a', 'b', 'c']];
      expect(raw.toSQL().bindings).to.eql(knex.client.prepBindings(expected1));
      expect(raw2.toSQL().bindings).to.eql(knex.client.prepBindings(expected2));
      //Also expect raw's bindings to not have been modified by calling .toSQL() (preserving original bindings)
      expect(raw.bindings).to.eql(expected1);
      expect(raw2.bindings).to.eql(expected2);
    });

    it('always returns the response object from raw', function () {
      if (isPostgreSQL(knex)) {
        return knex.raw('select id from accounts').then(function (resp) {
          assert(Array.isArray(resp.rows) === true);
        });
      }
    });

    it('properly escapes identifiers, #737', function () {
      if (isPostgreSQL(knex)) {
        const query = knex.select('id","name').from('test').toSQL();
        assert(query.sql === 'select "id"",""name" from "test"');
      }
    });

    it('knex.ref() as column in .select()', function () {
      return knex('accounts')
        .select([knex.ref('accounts.id').as('userid')])
        .where(knex.ref('accounts.id'), '1')
        .first()
        .then(function (row) {
          expect(String(row.userid)).to.equal('1');

          return true;
        });
    });

    it.skip('select forUpdate().first() bug in oracle (--------- TODO: FIX)', function () {
      return knex('accounts').where('id', 1).forUpdate().first();
    });

    it('select for update locks selected row', function () {
      if (isSQLite(knex)) {
        return this.skip();
      }

      return knex('test_default_table')
        .insert({ string: 'making sure there is a row to lock' })
        .then(() => {
          return knex
            .transaction((trx) => {
              // select all from test table and lock
              return trx('test_default_table')
                .forUpdate()
                .then((res) => {
                  // try to select stuff from table in other connection should just hang...
                  return knex('test_default_table').forUpdate().timeout(100);
                });
            })
            .then((res) => {
              expect('Second query should have timed out').to.be.false;
            })
            .catch((err) => {
              expect(err.message).to.be.contain(
                'Defined query timeout of 100ms exceeded when running query'
              );
            });
        });
    });

    it('select for update locks only some tables, #2834', function () {
      if (!isPostgreSQL(knex)) {
        return this.skip();
      }

      return knex('test_default_table')
        .insert({ string: 'making sure there is a row to lock', tinyint: 1 })
        .then(() => {
          return knex('test_default_table2')
            .insert({
              string: 'making sure there is a row to lock',
              tinyint: 1,
            })
            .then(() => {
              return knex
                .transaction((trx) => {
                  // select all from two test tables and lock only one table
                  return trx('test_default_table')
                    .innerJoin(
                      'test_default_table2',
                      'test_default_table.tinyint',
                      'test_default_table2.tinyint'
                    )
                    .forUpdate('test_default_table')
                    .then((res) => {
                      // try to select stuff from unlocked table should not hang...
                      return knex('test_default_table2')
                        .forUpdate()
                        .timeout(150);
                    })
                    .then((res) => {
                      // try to select stuff from table in other connection should just hang...
                      return knex('test_default_table')
                        .forUpdate()
                        .timeout(100);
                    });
                })
                .then((res) => {
                  expect('Second query should have timed out').to.be.false;
                })
                .catch((err) => {
                  expect(err.message).to.be.contain(
                    'Defined query timeout of 100ms exceeded when running query'
                  );
                });
            });
        });
    });

    it('select for share prevents updating in other transaction', function () {
      if (isSQLite(knex) || isOracle(knex)) {
        return this.skip();
      }

      return knex('test_default_table')
        .insert({ string: 'making sure there is a row to lock' })
        .then(() => {
          return knex
            .transaction((trx) => {
              // select all from test table and lock
              return trx('test_default_table')
                .forShare()
                .then((res) => {
                  // try to update row that was selected for share should just hang...
                  return knex.transaction((trx2) => {
                    return trx2('test_default_table')
                      .update({ string: 'foo' })
                      .timeout(100);
                  });
                });
            })
            .then((res) => {
              expect('Second query should have timed out').to.be.false;
            })
            .catch((err) => {
              // mssql fails because it tires to rollback at the same time when update query is running
              // hopefully for share really works though...
              if (isMssql(knex)) {
                expect(err.message).to.be.contain(
                  "Can't rollback transaction. There is a request in progress"
                );
              } else {
                expect(err.message).to.be.contain(
                  'Defined query timeout of 100ms exceeded when running query'
                );
              }
            });
        });
    });

    it('forUpdate().skipLocked() with order by should return the first non-locked row', async function () {
      // Note: this test doesn't work properly on MySQL - see https://bugs.mysql.com/bug.php?id=67745
      if (!isPostgreSQL(knex)) {
        return this.skip();
      }

      const rowName = 'row for skipLocked() test #1';
      await knex('test_default_table').delete().where({ string: rowName });
      await knex('test_default_table').insert([
        { string: rowName, tinyint: 1 },
        { string: rowName, tinyint: 2 },
      ]);

      const res = await knex.transaction(async (trx) => {
        // lock the first row in the test
        await trx('test_default_table')
          .where({ string: rowName })
          .orderBy('tinyint', 'asc')
          .forUpdate()
          .first();

        // try to lock the next available row from outside of the transaction
        return await knex('test_default_table')
          .where({ string: rowName })
          .orderBy('tinyint', 'asc')
          .forUpdate()
          .skipLocked()
          .first();
      });

      // assert that we got the second row because the first one was locked
      expect(res.tinyint).to.equal(2);
    });

    it('forUpdate().skipLocked() should return an empty set when all rows are locked', async function () {
      if (!isPostgreSQL(knex) && !isMysql(knex)) {
        return this.skip();
      }

      const rowName = 'row for skipLocked() test #2';
      await knex('test_default_table').delete().where({ string: rowName });
      await knex('test_default_table').insert([
        { string: rowName, tinyint: 1 },
        { string: rowName, tinyint: 2 },
      ]);

      const res = await knex.transaction(async (trx) => {
        // lock all of the test rows
        await trx('test_default_table').where({ string: rowName }).forUpdate();

        // try to aquire the lock on one more row (which isn't available) from another transaction
        return await knex('test_default_table')
          .where({ string: rowName })
          .forUpdate()
          .skipLocked()
          .first();
      });

      expect(res).to.be.undefined;
    });

    it('forUpdate().noWait() should throw an error immediately when a row is locked', async function () {
      if (!isPostgreSQL(knex) && !isMysql(knex)) {
        return this.skip();
      }

      const rowName = 'row for noWait() test';
      await knex('test_default_table').delete().where({ string: rowName });
      await knex('test_default_table').insert([
        { string: rowName, tinyint: 1 },
        { string: rowName, tinyint: 2 },
      ]);

      try {
        await knex.transaction(async (trx) => {
          // select and lock the first row from this test
          // note: MySQL may lock both rows depending on how the results are fetched
          await trx('test_default_table')
            .where({ string: rowName })
            .orderBy('tinyint', 'asc')
            .forUpdate()
            .first();

          // try to lock it again (it should fail here)
          await knex('test_default_table')
            .where({ string: rowName })
            .orderBy('tinyint', 'asc')
            .forUpdate()
            .noWait()
            .first();
        });

        // fail the test if the query finishes with no errors
        throw new Error(
          'The query should have been cancelled when trying to select a locked row with .noWait()'
        );
      } catch (err) {
        // check if we got the correct error from each db
        if (isPostgreSQL(knex)) {
          expect(err.message).to.contain('could not obtain lock on row');
        } else if (isMysql(knex)) {
          // mysql
          expect(err.message).to.contain(
            'lock(s) could not be acquired immediately'
          );
          // mariadb
          // TODO: detect if test is being run on mysql or mariadb to check for the correct error message
          // expect(err.message).to.contain('Lock wait timeout exceeded');
        } else {
          // unsupported database
          throw err;
        }
      }
    });

    it('select from subquery', async function () {
      const subquery = knex.from('accounts').whereBetween('id', [3, 5]);
      return knex
        .pluck('id')
        .orderBy('id')
        .from(subquery)
        .then(
          (rows) => {
            expect(rows).to.deep.equal([3, 4, 5]);
            expect(knex.client.driverName).to.oneOf(['sqlite3', 'oracledb']);
          },
          (e) => {
            if (isMysql(knex)) {
              expect(e.errno).to.equal(1248);
            } else if (isPostgreSQL(knex)) {
              expect(e.message).to.contain('must have an alias');
            } else if (isMssql(knex)) {
              expect(e.message).to.contain(
                "Incorrect syntax near the keyword 'order'"
              );
            } else {
              throw e;
            }
          }
        );
    });
  });
};
