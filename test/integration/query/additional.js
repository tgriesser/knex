/*eslint no-var:0, max-len:0 */
'use strict';

const { expect } = require('chai');

const Knex = require('../../../knex');
const _ = require('lodash');
const delay = require('../../../lib/execution/internal/delay');
const {
  isPostgreSQL,
  isOracle,
  isRedshift,
  isSQLite,
  isMysql,
  isMssql,
  isPgBased,
} = require('../../util/db-helpers');
const { DRIVER_NAMES: drivers } = require('../../util/constants');

module.exports = function (knex) {
  describe('Additional', function () {
    describe('Custom response processing', () => {
      before('setup custom response handler', () => {
        knex.client.config.postProcessResponse = (response, queryContext) => {
          response.callCount = response.callCount ? response.callCount + 1 : 1;
          response.queryContext = queryContext;
          return response;
        };
      });

      after('restore client configuration', () => {
        knex.client.config.postProcessResponse = null;
      });

      it('should process normal response', () => {
        return knex('accounts')
          .limit(1)
          .then((res) => {
            expect(res.callCount).to.equal(1);
          });
      });

      it('should pass query context to the custom handler', () => {
        return knex('accounts')
          .queryContext('the context')
          .limit(1)
          .then((res) => {
            expect(res.queryContext).to.equal('the context');
          });
      });

      it('should process raw response', () => {
        return knex.raw('select * from ??', ['accounts']).then((res) => {
          expect(res.callCount).to.equal(1);
        });
      });

      it('should pass query context for raw responses', () => {
        return knex
          .raw('select * from ??', ['accounts'])
          .queryContext('the context')
          .then((res) => {
            expect(res.queryContext).to.equal('the context');
          });
      });

      it('should process response done in transaction', () => {
        return knex
          .transaction((trx) => {
            return trx('accounts')
              .limit(1)
              .then((res) => {
                expect(res.callCount).to.equal(1);
                return res;
              });
          })
          .then((res) => {
            expect(res.callCount).to.equal(1);
          });
      });

      it('should pass query context for responses from transactions', () => {
        return knex
          .transaction((trx) => {
            return trx('accounts')
              .queryContext('the context')
              .limit(1)
              .then((res) => {
                expect(res.queryContext).to.equal('the context');
                return res;
              });
          })
          .then((res) => {
            expect(res.queryContext).to.equal('the context');
          });
      });

      it('should handle error correctly in a stream', (done) => {
        const stream = knex('wrongtable').limit(1).stream();
        stream.on('error', () => {
          done();
        });
      });

      it('should process response done through a stream', (done) => {
        let response;
        const stream = knex('accounts').limit(1).stream();

        stream.on('data', (res) => {
          response = res;
        });
        stream.on('finish', () => {
          expect(response.callCount).to.equal(1);
          done();
        });
      });

      it('should pass query context for responses through a stream', (done) => {
        let response;
        const stream = knex('accounts')
          .queryContext('the context')
          .limit(1)
          .stream();

        stream.on('data', (res) => {
          response = res;
        });
        stream.on('finish', () => {
          expect(response.queryContext).to.equal('the context');
          done();
        });
      });

      it('should process response for each row done through a stream', (done) => {
        const stream = knex('accounts').limit(5).stream();
        let count = 0;
        stream.on('data', () => count++);
        stream.on('finish', () => {
          expect(count).to.equal(5);
          done();
        });
      });
    });

    describe('columnInfo with wrapIdentifier and postProcessResponse', () => {
      before('setup hooks', () => {
        knex.client.config.postProcessResponse = (response) => {
          return _.mapKeys(response, (val, key) => {
            return _.camelCase(key);
          });
        };

        knex.client.config.wrapIdentifier = (id, origImpl) => {
          return origImpl(_.snakeCase(id));
        };
      });

      after('restore client configuration', () => {
        knex.client.config.postProcessResponse = null;
        knex.client.config.wrapIdentifier = null;
      });

      it('should work using camelCased table name', () => {
        return knex('testTableTwo')
          .columnInfo()
          .then((res) => {
            expect(Object.keys(res)).to.have.all.members([
              'id',
              'accountId',
              'details',
              'status',
              'jsonData',
            ]);
          });
      });

      it('should work using snake_cased table name', () => {
        return knex('test_table_two')
          .columnInfo()
          .then((res) => {
            expect(Object.keys(res)).to.have.all.members([
              'id',
              'accountId',
              'details',
              'status',
              'jsonData',
            ]);
          });
      });
    });

    describe('returning with wrapIdentifier and postProcessResponse` (TODO: fix to work on all possible dialects)', function () {
      const origHooks = {};
      if (!isPostgreSQL(knex) || !isMssql(knex)) {
        return;
      }

      before('setup custom hooks', () => {
        origHooks.postProcessResponse = knex.client.config.postProcessResponse;
        origHooks.wrapIdentifier = knex.client.config.wrapIdentifier;

        // Add `_foo` to each identifier.
        knex.client.config.postProcessResponse = (res) => {
          if (Array.isArray(res)) {
            return res.map((it) => {
              if (typeof it === 'object') {
                return _.mapKeys(it, (value, key) => {
                  return key + '_foo';
                });
              } else {
                return it;
              }
            });
          } else {
            return res;
          }
        };

        // Remove `_foo` from the end of each identifier.
        knex.client.config.wrapIdentifier = (id) => {
          return id.substring(0, id.length - 4);
        };
      });

      after('restore hooks', () => {
        knex.client.config.postProcessResponse = origHooks.postProcessResponse;
        knex.client.config.wrapIdentifier = origHooks.wrapIdentifier;
      });

      it('should return the correct column when a single property is given to returning', () => {
        return knex('accounts_foo')
          .insert({ balance_foo: 123 })
          .returning('balance_foo')
          .then((res) => {
            expect(res).to.eql([123]);
          });
      });

      it('should return the correct columns when multiple properties are given to returning', () => {
        return knex('accounts_foo')
          .insert({ balance_foo: 123, email_foo: 'foo@bar.com' })
          .returning(['balance_foo', 'email_foo'])
          .then((res) => {
            expect(res).to.eql([
              { balance_foo: 123, email_foo: 'foo@bar.com' },
            ]);
          });
      });
    });

    it('should truncate a table with truncate', function () {
      return knex('test_table_two')
        .truncate()
        .testSql(function (tester) {
          tester('mysql', 'truncate `test_table_two`');
          tester('pg', 'truncate "test_table_two" restart identity');
          tester('pg-redshift', 'truncate "test_table_two"');
          tester('sqlite3', 'delete from `test_table_two`');
          tester('oracledb', 'truncate table "test_table_two"');
          tester('mssql', 'truncate table [test_table_two]');
        })
        .then(() => {
          return knex('test_table_two')
            .select('*')
            .then((resp) => {
              expect(resp).to.have.length(0);
            });
        })
        .then(() => {
          // Insert new data after truncate and make sure ids restart at 1.
          // This doesn't currently work on oracle, where the created sequence
          // needs to be manually reset.
          // On redshift, one would need to create an entirely new table and do
          //  `insert into ... (select ...); alter table rename...`
          if (isOracle(knex) || isRedshift(knex)) {
            return;
          }
          return knex('test_table_two')
            .insert({ status: 1 })
            .then((res) => {
              return knex('test_table_two')
                .select('id')
                .first()
                .then((res) => {
                  expect(res).to.be.an('object');
                  expect(res.id).to.equal(1);
                });
            });
        });
    });

    it('should allow raw queries directly with `knex.raw`', function () {
      const tables = {
        [drivers.MySQL]: 'SHOW TABLES',
        [drivers.MySQL2]: 'SHOW TABLES',
        [drivers.PostgreSQL]:
          "SELECT table_name FROM information_schema.tables WHERE table_schema='public'",
        [drivers.Redshift]:
          "SELECT table_name FROM information_schema.tables WHERE table_schema='public'",
        [drivers.SQLite]: "SELECT name FROM sqlite_master WHERE type='table';",
        [drivers.Oracle]: 'select TABLE_NAME from USER_TABLES',
        [drivers.MsSQL]:
          "SELECT table_name FROM information_schema.tables WHERE table_schema='dbo'",
      };
      return knex
        .raw(tables[knex.client.driverName])
        .testSql(function (tester) {
          tester(knex.client.driverName, tables[knex.client.driverName]);
        });
    });

    it('should allow using the primary table as a raw statement', function () {
      expect(knex(knex.raw('raw_table_name')).toQuery()).to.equal(
        'select * from raw_table_name'
      );
    });

    it('should allow using .fn-methods to create raw statements', function () {
      expect(knex.fn.now().prototype === knex.raw().prototype);
      expect(knex.fn.now().toQuery()).to.equal('CURRENT_TIMESTAMP');
      expect(knex.fn.now(6).toQuery()).to.equal('CURRENT_TIMESTAMP(6)');
    });

    it('gets the columnInfo', function () {
      return knex('datatype_test')
        .columnInfo()
        .testSql(function (tester) {
          tester(
            'mysql',
            'select * from information_schema.columns where table_name = ? and table_schema = ?',
            null,
            {
              enum_value: {
                defaultValue: null,
                maxLength: 1,
                nullable: true,
                type: 'enum',
              },
              uuid: {
                defaultValue: null,
                maxLength: 36,
                nullable: false,
                type: 'char',
              },
            }
          );
          tester(
            'pg',
            'select * from information_schema.columns where table_name = ? and table_catalog = ? and table_schema = current_schema()',
            null,
            {
              enum_value: {
                defaultValue: null,
                maxLength: null,
                nullable: true,
                type: 'text',
              },
              uuid: {
                defaultValue: null,
                maxLength: null,
                nullable: false,
                type: 'uuid',
              },
            }
          );
          tester(
            'pg-redshift',
            'select * from information_schema.columns where table_name = ? and table_catalog = ? and table_schema = current_schema()',
            null,
            {
              enum_value: {
                defaultValue: null,
                maxLength: 255,
                nullable: true,
                type: 'character varying',
              },
              uuid: {
                defaultValue: null,
                maxLength: 36,
                nullable: false,
                type: 'character',
              },
            }
          );
          tester('sqlite3', 'PRAGMA table_info(`datatype_test`)', [], {
            enum_value: {
              defaultValue: null,
              maxLength: null,
              nullable: true,
              type: 'text',
            },
            uuid: {
              defaultValue: null,
              maxLength: '36',
              nullable: false,
              type: 'char',
            },
          });
          tester(
            'oracledb',
            "select * from xmltable( '/ROWSET/ROW'\n      passing dbms_xmlgen.getXMLType('\n      select char_col_decl_length, column_name, data_type, data_default, nullable\n      from all_tab_columns where table_name = ''datatype_test'' ')\n      columns\n      CHAR_COL_DECL_LENGTH number, COLUMN_NAME varchar2(200), DATA_TYPE varchar2(106),\n      DATA_DEFAULT clob, NULLABLE varchar2(1))",
            [],
            {
              enum_value: {
                defaultValue: null,
                nullable: true,
                maxLength: 1,
                type: 'VARCHAR2',
              },
              uuid: {
                defaultValue: null,
                nullable: false,
                maxLength: 36,
                type: 'CHAR',
              },
            }
          );
          tester(
            'mssql',
            "select [COLUMN_NAME], [COLUMN_DEFAULT], [DATA_TYPE], [CHARACTER_MAXIMUM_LENGTH], [IS_NULLABLE] from information_schema.columns where table_name = ? and table_catalog = ? and table_schema = 'dbo'",
            ['datatype_test', 'knex_test'],
            {
              enum_value: {
                defaultValue: null,
                maxLength: 100,
                nullable: true,
                type: 'nvarchar',
              },
              uuid: {
                defaultValue: null,
                maxLength: null,
                nullable: false,
                type: 'uniqueidentifier',
              },
            }
          );
        });
    });

    it('gets the columnInfo with columntype', function () {
      return knex('datatype_test')
        .columnInfo('uuid')
        .testSql(function (tester) {
          tester(
            'mysql',
            'select * from information_schema.columns where table_name = ? and table_schema = ?',
            null,
            {
              defaultValue: null,
              maxLength: 36,
              nullable: false,
              type: 'char',
            }
          );
          tester(
            'pg',
            'select * from information_schema.columns where table_name = ? and table_catalog = ? and table_schema = current_schema()',
            null,
            {
              defaultValue: null,
              maxLength: null,
              nullable: false,
              type: 'uuid',
            }
          );
          tester(
            'pg-redshift',
            'select * from information_schema.columns where table_name = ? and table_catalog = ? and table_schema = current_schema()',
            null,
            {
              defaultValue: null,
              maxLength: 36,
              nullable: false,
              type: 'character',
            }
          );
          tester('sqlite3', 'PRAGMA table_info(`datatype_test`)', [], {
            defaultValue: null,
            maxLength: '36',
            nullable: false,
            type: 'char',
          });
          tester(
            'oracledb',
            "select * from xmltable( '/ROWSET/ROW'\n      passing dbms_xmlgen.getXMLType('\n      select char_col_decl_length, column_name, data_type, data_default, nullable\n      from all_tab_columns where table_name = ''datatype_test'' ')\n      columns\n      CHAR_COL_DECL_LENGTH number, COLUMN_NAME varchar2(200), DATA_TYPE varchar2(106),\n      DATA_DEFAULT clob, NULLABLE varchar2(1))",
            [],
            {
              defaultValue: null,
              maxLength: 36,
              nullable: false,
              type: 'CHAR',
            }
          );
          tester(
            'mssql',
            "select [COLUMN_NAME], [COLUMN_DEFAULT], [DATA_TYPE], [CHARACTER_MAXIMUM_LENGTH], [IS_NULLABLE] from information_schema.columns where table_name = ? and table_catalog = ? and table_schema = 'dbo'",
            null,
            {
              defaultValue: null,
              maxLength: null,
              nullable: false,
              type: 'uniqueidentifier',
            }
          );
        });
    });

    it('#2184 - should properly escape table name for SQLite columnInfo', function () {
      if (!isSQLite(knex)) {
        return this.skip();
      }

      return knex.schema
        .dropTableIfExists('group')
        .then(function () {
          return knex.schema.createTable('group', function (table) {
            table.integer('foo');
          });
        })
        .then(function () {
          return knex('group').columnInfo();
        })
        .then(function (columnInfo) {
          expect(columnInfo).to.deep.equal({
            foo: {
              type: 'integer',
              maxLength: null,
              nullable: true,
              defaultValue: null,
            },
          });
        });
    });

    if (isOracle(knex)) {
      const oracledb = require('oracledb');
      describe('test oracle stored procedures', function () {
        it('create stored procedure', function () {
          return knex
            .raw(
              `
            CREATE OR REPLACE PROCEDURE SYSTEM.multiply (X IN NUMBER, Y IN NUMBER, OUTPUT OUT NUMBER)
              IS
              BEGIN
                OUTPUT := X * Y;
              END;`
            )
            .then(function (result) {
              expect(result).to.be.an('array');
            });
        });

        it('get outbound values from stored procedure', function () {
          const bindVars = {
            x: 6,
            y: 7,
            output: {
              dir: oracledb.BIND_OUT,
            },
          };
          return knex
            .raw('BEGIN SYSTEM.MULTIPLY(:x, :y, :output); END;', bindVars)
            .then(function (result) {
              expect(result[0]).to.be.ok;
              expect(result[0]).to.equal('42');
            });
        });

        it('drop stored procedure', function () {
          const bindVars = { x: 6, y: 7 };
          return knex
            .raw('drop procedure SYSTEM.MULTIPLY', bindVars)
            .then(function (result) {
              expect(result).to.be.ok;
              expect(result).to.be.an('array');
            });
        });
      });
    }

    it('should allow renaming a column', function () {
      let countColumn;
      if (isOracle(knex)) {
        countColumn = 'COUNT(*)';
      } else if (isMssql(knex)) {
        countColumn = '';
      } else {
        countColumn = 'count(*)';
      }

      let count;
      const inserts = [];
      _.times(40, function (i) {
        inserts.push({
          email: 'email' + i,
          first_name: 'Test',
          last_name: 'Data',
        });
      });
      return knex('accounts')
        .insert(inserts)
        .then(function () {
          return knex.count('*').from('accounts');
        })
        .then(function (resp) {
          count = resp[0][countColumn];
          return knex.schema
            .table('accounts', function (t) {
              t.renameColumn('about', 'about_col');
            })
            .testSql(function (tester) {
              tester('mysql', ['show fields from `accounts` where field = ?']);
              tester('pg', [
                'alter table "accounts" rename "about" to "about_col"',
              ]);
              tester('pg-redshift', [
                'alter table "accounts" rename "about" to "about_col"',
              ]);
              tester('sqlite3', [
                'alter table `accounts` rename `about` to `about_col`',
              ]);
              tester('oracledb', [
                'DECLARE PK_NAME VARCHAR(200); IS_AUTOINC NUMBER := 0; BEGIN  EXECUTE IMMEDIATE (\'ALTER TABLE "accounts" RENAME COLUMN "about" TO "about_col"\');  SELECT COUNT(*) INTO IS_AUTOINC from "USER_TRIGGERS" where trigger_name = \'accounts_autoinc_trg\';  IF (IS_AUTOINC > 0) THEN    SELECT cols.column_name INTO PK_NAME    FROM all_constraints cons, all_cons_columns cols    WHERE cons.constraint_type = \'P\'    AND cons.constraint_name = cols.constraint_name    AND cons.owner = cols.owner    AND cols.table_name = \'accounts\';    IF (\'about_col\' = PK_NAME) THEN      EXECUTE IMMEDIATE (\'DROP TRIGGER "accounts_autoinc_trg"\');      EXECUTE IMMEDIATE (\'create or replace trigger "accounts_autoinc_trg"      BEFORE INSERT on "accounts" for each row        declare        checking number := 1;        begin          if (:new."about_col" is null) then            while checking >= 1 loop              select "accounts_seq".nextval into :new."about_col" from dual;              select count("about_col") into checking from "accounts"              where "about_col" = :new."about_col";            end loop;          end if;        end;\');    end if;  end if;END;',
              ]);
              tester('mssql', ["exec sp_rename ?, ?, 'COLUMN'"]);
            });
        })
        .then(function () {
          return knex.count('*').from('accounts');
        })
        .then(function (resp) {
          expect(resp[0][countColumn]).to.equal(count);
        })
        .then(function () {
          return knex('accounts').select('about_col');
        })
        .then(function () {
          return knex.schema.table('accounts', function (t) {
            t.renameColumn('about_col', 'about');
          });
        })
        .then(function () {
          return knex.count('*').from('accounts');
        })
        .then(function (resp) {
          expect(resp[0][countColumn]).to.equal(count);
        });
    });

    it('should allow dropping a column', function () {
      let countColumn;
      if (isOracle(knex)) {
        countColumn = 'COUNT(*)';
      } else if (isMssql(knex)) {
        countColumn = '';
      } else {
        countColumn = 'count(*)';
      }

      let count;
      return knex
        .count('*')
        .from('accounts')
        .then(function (resp) {
          count = resp[0][countColumn];
        })
        .then(function () {
          return knex.schema
            .table('accounts', function (t) {
              t.dropColumn('first_name');
            })
            .testSql(function (tester) {
              tester('mysql', ['alter table `accounts` drop `first_name`']);
              tester('pg', ['alter table "accounts" drop column "first_name"']);
              tester('pg-redshift', [
                'alter table "accounts" drop column "first_name"',
              ]);
              tester('sqlite3', ['PRAGMA table_info(`accounts`)']);
              tester('oracledb', [
                'alter table "accounts" drop ("first_name")',
              ]);
              //tester('oracledb', ['alter table "accounts" drop ("first_name")']);
              tester('mssql', [
                "\n              DECLARE @constraint varchar(100) = (SELECT default_constraints.name\n                                                  FROM sys.all_columns\n                                                  INNER JOIN sys.tables\n                                                    ON all_columns.object_id = tables.object_id\n                                                  INNER JOIN sys.schemas\n                                                    ON tables.schema_id = schemas.schema_id\n                                                  INNER JOIN sys.default_constraints\n                                                    ON all_columns.default_object_id = default_constraints.object_id\n                                                  WHERE schemas.name = 'dbo'\n                                                  AND tables.name = 'accounts'\n                                                  AND all_columns.name = 'first_name')\n\n              IF @constraint IS NOT NULL EXEC('ALTER TABLE accounts DROP CONSTRAINT ' + @constraint)",
                'ALTER TABLE [accounts] DROP COLUMN [first_name]',
              ]);
            });
        })
        .then(function () {
          return knex.select('*').from('accounts').first();
        })
        .then(function (resp) {
          expect(_.keys(resp).sort()).to.eql([
            'about',
            'balance',
            'created_at',
            'email',
            'id',
            'last_name',
            'logins',
            'phone',
            'updated_at',
          ]);
        })
        .then(function () {
          return knex.count('*').from('accounts');
        })
        .then(function (resp) {
          expect(resp[0][countColumn]).to.equal(count);
        });
    });

    it('.timeout() should throw TimeoutError', function () {
      const driverName = knex.client.driverName;
      if (isSQLite(knex)) {
        return this.skip();
      } //TODO -- No built-in support for sleeps

      if (isRedshift(knex)) {
        return this.skip();
      }

      const testQueries = {
        [drivers.PostgreSQL]: function () {
          return knex.raw('SELECT pg_sleep(1)');
        },
        [drivers.PgNative]: function () {
          return knex.raw('SELECT pg_sleep(1)');
        },
        [drivers.MySQL]: function () {
          return knex.raw('SELECT SLEEP(1)');
        },
        [drivers.MySQL2]: function () {
          return knex.raw('SELECT SLEEP(1)');
        },
        [drivers.MsSQL]: function () {
          return knex.raw("WAITFOR DELAY '00:00:01'");
        },
        [drivers.Oracle]: function () {
          return knex.raw('begin dbms_lock.sleep(1); end;');
        },
      };

      if (!Object.prototype.hasOwnProperty.call(testQueries, driverName)) {
        throw new Error('Missing test query for driver: ' + driverName);
      }

      const query = testQueries[driverName]();

      return query
        .timeout(200)
        .then(function () {
          expect(true).to.equal(false);
        })
        .catch(function (error) {
          expect(_.pick(error, 'timeout', 'name', 'message')).to.deep.equal({
            timeout: 200,
            name: 'KnexTimeoutError',
            message:
              'Defined query timeout of 200ms exceeded when running query.',
          });
        });
    });

    it('.timeout(ms, {cancel: true}) should throw TimeoutError and cancel slow query', function () {
      if (isSQLite(knex)) {
        return this.skip();
      } //TODO -- No built-in support for sleeps
      if (isRedshift(knex)) {
        return this.skip();
      }

      // There's unexpected behavior caused by knex releasing a connection back
      // to the pool because of a timeout when a long query is still running.
      // A subsequent query will acquire the connection (still in-use) and hang
      // until the first query finishes. Setting a sleep time longer than the
      // mocha timeout exposes this behavior.
      const testQueries = {
        [drivers.PostgreSQL]: function () {
          return knex.raw('SELECT pg_sleep(10)');
        },
        [drivers.PgNative]: function () {
          return knex.raw('SELECT pg_sleep(10)');
        },
        [drivers.MySQL]: function () {
          return knex.raw('SELECT SLEEP(10)');
        },
        [drivers.MySQL2]: function () {
          return knex.raw('SELECT SLEEP(10)');
        },
        [drivers.MsSQL]: function () {
          return knex.raw("WAITFOR DELAY '00:00:10'");
        },
        [drivers.Oracle]: function () {
          return knex.raw('begin dbms_lock.sleep(10); end;');
        },
      };

      const driverName = knex.client.driverName;
      if (!Object.prototype.hasOwnProperty.call(testQueries, driverName)) {
        throw new Error('Missing test query for driverName: ' + driverName);
      }

      const query = testQueries[driverName]();

      function addTimeout() {
        return query.timeout(200, { cancel: true });
      }

      // Only mysql/postgres query cancelling supported for now
      if (!isMysql(knex) && !isPostgreSQL(knex)) {
        expect(addTimeout).to.throw(
          'Query cancelling not supported for this dialect'
        );
        return; // TODO: Use `this.skip()` here?
      }

      const getProcessesQueries = {
        [drivers.PostgreSQL]: function () {
          return knex.raw('SELECT * from pg_stat_activity');
        },
        [drivers.MySQL]: function () {
          return knex.raw('SHOW PROCESSLIST');
        },
        [drivers.MySQL2]: function () {
          return knex.raw('SHOW PROCESSLIST');
        },
      };

      if (
        !Object.prototype.hasOwnProperty.call(getProcessesQueries, driverName)
      ) {
        throw new Error('Missing test query for driverName: ' + driverName);
      }

      const getProcessesQuery = getProcessesQueries[driverName]();

      return addTimeout()
        .then(function () {
          expect(true).to.equal(false);
        })
        .catch(function (error) {
          expect(_.pick(error, 'timeout', 'name', 'message')).to.deep.equal({
            timeout: 200,
            name: 'KnexTimeoutError',
            message:
              'Defined query timeout of 200ms exceeded when running query.',
          });

          // Ensure sleep command is removed.
          // This query will hang if a connection gets released back to the pool
          // too early.
          // 50ms delay since killing query doesn't seem to have immediate effect to the process listing
          return delay(50)
            .then(function () {
              return getProcessesQuery;
            })
            .then(function (results) {
              let processes;
              let sleepProcess;

              if (isPgBased(knex)) {
                processes = results.rows;
                sleepProcess = _.find(processes, { query: query.toString() });
              } else {
                processes = results[0];
                sleepProcess = _.find(processes, {
                  Info: 'SELECT SLEEP(10)',
                });
              }
              expect(sleepProcess).to.equal(undefined);
            });
        });
    });

    it('.timeout(ms, {cancel: true}) should throw TimeoutError and cancel slow query in transaction', function () {
      const driverName = knex.client.driverName;
      if (driverName === 'sqlite3') {
        return this.skip();
      } //TODO -- No built-in support for sleeps
      if (/redshift/.test(driverName)) {
        return this.skip();
      }

      // There's unexpected behavior caused by knex releasing a connection back
      // to the pool because of a timeout when a long query is still running.
      // A subsequent query will acquire the connection (still in-use) and hang
      // until the first query finishes. Setting a sleep time longer than the
      // mocha timeout exposes this behavior.
      const testQueries = {
        [drivers.PostgreSQL]: function () {
          return knex.raw('SELECT pg_sleep(10)');
        },
        [drivers.PgNative]: function () {
          return knex.raw('SELECT pg_sleep(10)');
        },
        [drivers.MySQL]: function () {
          return knex.raw('SELECT SLEEP(10)');
        },
        [drivers.MySQL2]: function () {
          return knex.raw('SELECT SLEEP(10)');
        },
        [drivers.MsSQL]: function () {
          return knex.raw("WAITFOR DELAY '00:00:10'");
        },
        [drivers.Oracle]: function () {
          return knex.raw('begin dbms_lock.sleep(10); end;');
        },
      };

      if (!Object.prototype.hasOwnProperty.call(testQueries, driverName)) {
        throw new Error('Missing test query for driverName: ' + driverName);
      }

      const query = testQueries[driverName]();

      function addTimeout() {
        return query.timeout(200, { cancel: true });
      }

      // Only mysql/postgres query cancelling supported for now
      if (
        !_.startsWith(driverName, 'mysql') &&
        !_.startsWith(driverName, 'pg')
      ) {
        expect(addTimeout).to.throw(
          'Query cancelling not supported for this dialect'
        );
        return; // TODO: Use `this.skip()` here?
      }

      const getProcessesQueries = {
        pg: function () {
          return knex.raw('SELECT * from pg_stat_activity');
        },
        mysql: function () {
          return knex.raw('SHOW PROCESSLIST');
        },
        mysql2: function () {
          return knex.raw('SHOW PROCESSLIST');
        },
      };

      if (
        !Object.prototype.hasOwnProperty.call(getProcessesQueries, driverName)
      ) {
        throw new Error('Missing test query for driverName: ' + driverName);
      }

      const getProcessesQuery = getProcessesQueries[driverName]();

      return knex
        .transaction((trx) => addTimeout().transacting(trx))
        .then(function () {
          expect(true).to.equal(false);
        })
        .catch(function (error) {
          expect(_.pick(error, 'timeout', 'name', 'message')).to.deep.equal({
            timeout: 200,
            name: 'KnexTimeoutError',
            message:
              'Defined query timeout of 200ms exceeded when running query.',
          });

          // Ensure sleep command is removed.
          // This query will hang if a connection gets released back to the pool
          // too early.
          // 50ms delay since killing query doesn't seem to have immediate effect to the process listing
          return delay(50)
            .then(function () {
              return getProcessesQuery;
            })
            .then(function (results) {
              let processes;
              let sleepProcess;

              if (_.startsWith(driverName, 'pg')) {
                processes = results.rows;
                sleepProcess = _.find(processes, { query: query.toString() });
              } else {
                processes = results[0];
                sleepProcess = _.find(processes, {
                  Info: 'SELECT SLEEP(10)',
                });
              }
              expect(sleepProcess).to.equal(undefined);
            });
        });
    });

    it('.timeout(ms, {cancel: true}) should cancel slow query even if connection pool is exhausted', async function () {
      // Only mysql/postgres query cancelling supported for now
      if (!isMysql(knex) && !isPostgreSQL(knex)) {
        return this.skip();
      }

      // To make this test easier, I'm changing the pool settings to max 1.
      // Also setting acquireTimeoutMillis to lower as not to wait the default time
      const knexConfig = _.cloneDeep(knex.client.config);
      knexConfig.pool.min = 0;
      knexConfig.pool.max = 1;
      knexConfig.pool.acquireTimeoutMillis = 100;

      const knexDb = new Knex(knexConfig);

      const testQueries = {
        [drivers.PostgreSQL]: function () {
          return knexDb.raw('SELECT pg_sleep(10)');
        },
        [drivers.PgNative]: function () {
          return knexDb.raw('SELECT pg_sleep(10)');
        },
        [drivers.MySQL]: function () {
          return knexDb.raw('SELECT SLEEP(10)');
        },
        [drivers.MySQL2]: function () {
          return knexDb.raw('SELECT SLEEP(10)');
        },
        [drivers.MsSQL]: function () {
          return knexDb.raw("WAITFOR DELAY '00:00:10'");
        },
        [drivers.Oracle]: function () {
          return knexDb.raw('begin dbms_lock.sleep(10); end;');
        },
      };

      const driverName = knex.client.driverName;
      if (!Object.prototype.hasOwnProperty.call(testQueries, driverName)) {
        throw new Error('Missing test query for dialect: ' + driverName);
      }

      const query = testQueries[driverName]();

      // We must use the original knex instance without the exhausted pool to list running queries
      const getProcessesForDriver = {
        pg: async () => {
          const results = await knex.raw('SELECT * from pg_stat_activity');
          return _.map(_.filter(results.rows, { state: 'active' }), 'query');
        },
        mysql: async () => {
          const results = await knex.raw('SHOW PROCESSLIST');
          return _.map(results[0], 'Info');
        },
        mysql2: async () => {
          const results = await knex.raw('SHOW PROCESSLIST');
          return _.map(results[0], 'Info');
        },
      };

      if (
        !Object.prototype.hasOwnProperty.call(getProcessesForDriver, driverName)
      ) {
        throw new Error('Missing test query for driverName: ' + driverName);
      }

      const getProcesses = getProcessesForDriver[driverName];

      try {
        const promise = query.timeout(50, { cancel: true }).then(_.identity);

        await delay(10);
        const processesBeforeTimeout = await getProcesses();
        expect(processesBeforeTimeout).to.include(query.toString());

        await expect(promise).to.eventually.be.rejected.and.to.deep.include({
          timeout: 50,
          name: 'KnexTimeoutError',
          message: 'Defined query timeout of 50ms exceeded when running query.',
        });

        const processesAfterTimeout = await getProcesses();
        expect(processesAfterTimeout).to.not.include(query.toString());
      } finally {
        await knexDb.destroy();
      }
    });

    it('.timeout(ms, {cancel: true}) should release connections after failing if connection cancellation throws an error', async function () {
      // Only mysql/postgres query cancelling supported for now
      if (!isPostgreSQL(knex)) {
        return this.skip();
      }

      // To make this test easier, I'm changing the pool settings to max 1.
      // Also setting acquireTimeoutMillis to lower as not to wait the default time
      const knexConfig = _.cloneDeep(knex.client.config);
      knexConfig.pool.min = 0;
      knexConfig.pool.max = 2;
      knexConfig.pool.acquireTimeoutMillis = 100;

      const rawTestQueries = {
        [drivers.PostgreSQL]: (sleepSeconds) =>
          `SELECT pg_sleep(${sleepSeconds})`,
      };

      const driverName = knex.client.driverName;
      if (!Object.prototype.hasOwnProperty.call(rawTestQueries, driverName)) {
        throw new Error('Missing test query for driverName: ' + driverName);
      }

      const knexDb = new Knex(knexConfig);

      const getTestQuery = (sleepSeconds = 10) => {
        const rawTestQuery = rawTestQueries[driverName](sleepSeconds);
        return knexDb.raw(rawTestQuery);
      };

      const knexPrototype = Object.getPrototypeOf(knexDb.client);
      const originalWrappedCancelQueryCall =
        knexPrototype._wrappedCancelQueryCall;

      knexPrototype._wrappedCancelQueryCall = (conn) => {
        return knexPrototype.query(conn, {
          method: 'raw',
          sql: 'TestError',
        });
      };

      const queryTimeout = 10;
      const secondQueryTimeout = 11;

      try {
        await expect(
          getTestQuery().timeout(queryTimeout, { cancel: true })
        ).to.be.eventually.rejected.and.deep.include({
          timeout: queryTimeout,
          name: 'error',
          message: `After query timeout of ${queryTimeout}ms exceeded, cancelling of query failed.`,
        });

        knexPrototype._wrappedCancelQueryCall = originalWrappedCancelQueryCall;

        await expect(
          getTestQuery().timeout(secondQueryTimeout, { cancel: true })
        ).to.be.eventually.rejected.and.deep.include({
          timeout: secondQueryTimeout,
          name: 'KnexTimeoutError',
          message: `Defined query timeout of ${secondQueryTimeout}ms exceeded when running query.`,
        });
      } finally {
        await knexDb.destroy();
      }
    });

    it('Event: query-response', function () {
      let queryCount = 0;

      const onQueryResponse = function (response, obj, builder) {
        queryCount++;
        expect(response).to.be.an('array');
        expect(obj).to.be.an('object');
        expect(obj.__knexUid).to.be.a('string');
        expect(obj.__knexQueryUid).to.be.a('string');
        expect(builder).to.be.an('object');
      };
      knex.on('query-response', onQueryResponse);

      return knex('accounts')
        .select()
        .on('query-response', onQueryResponse)
        .then(function () {
          return knex.transaction(function (tr) {
            return tr('accounts')
              .select()
              .on('query-response', onQueryResponse); //Transactions should emit the event as well
          });
        })
        .then(function () {
          knex.removeListener('query-response', onQueryResponse);
          expect(queryCount).to.equal(4);
        });
    });

    it('Event: preserves listeners on a copy with user params', function () {
      let queryCount = 0;

      const onQueryResponse = function (response, obj, builder) {
        queryCount++;
        expect(response).to.be.an('array');
        expect(obj).to.be.an('object');
        expect(obj.__knexUid).to.be.a('string');
        expect(obj.__knexQueryUid).to.be.a('string');
        expect(builder).to.be.an('object');
      };
      knex.on('query-response', onQueryResponse);
      const knexCopy = knex.withUserParams({});

      return knexCopy('accounts')
        .select()
        .on('query-response', onQueryResponse)
        .then(function () {
          return knexCopy.transaction(function (tr) {
            return tr('accounts')
              .select()
              .on('query-response', onQueryResponse); //Transactions should emit the event as well
          });
        })
        .then(function () {
          expect(Object.keys(knex._events).length).to.equal(1);
          expect(Object.keys(knexCopy._events).length).to.equal(1);
          knex.removeListener('query-response', onQueryResponse);
          expect(Object.keys(knex._events).length).to.equal(0);
          expect(queryCount).to.equal(4);
        });
    });

    it('Event: query-error', function () {
      let queryCountKnex = 0;
      let queryCountBuilder = 0;
      const onQueryErrorKnex = function (error, obj) {
        queryCountKnex++;
        expect(obj).to.be.an('object');
        expect(obj.__knexUid).to.be.a('string');
        expect(obj.__knexQueryUid).to.be.a('string');
        expect(error).to.be.an('error');
      };

      const onQueryErrorBuilder = function (error, obj) {
        queryCountBuilder++;
        expect(obj).to.be.an('object');
        expect(obj.__knexUid).to.be.a('string');
        expect(obj.__knexQueryUid).to.be.a('string');
        expect(error).to.be.an('error');
      };

      knex.on('query-error', onQueryErrorKnex);

      return knex
        .raw('Broken query')
        .on('query-error', onQueryErrorBuilder)
        .then(function () {
          expect(true).to.equal(false); //Should not be resolved
        })
        .catch(function () {
          knex.removeListener('query-error', onQueryErrorKnex);
          knex.removeListener('query-error', onQueryErrorBuilder);
          expect(queryCountBuilder).to.equal(1);
          expect(queryCountKnex).to.equal(1);
        });
    });

    it('Event: start', function () {
      return knex('accounts')
        .insert({ last_name: 'Start event test' })
        .then(function () {
          const queryBuilder = knex('accounts').select();

          queryBuilder.on('start', function (builder) {
            //Alter builder prior to compilation
            //Select only one row
            builder.where('last_name', 'Start event test').first();
          });

          return queryBuilder;
        })
        .then(function (row) {
          expect(row).to.exist;
          expect(row.last_name).to.equal('Start event test');
        });
    });

    it("Event 'query' should not emit native sql string", function () {
      const builder = knex('accounts').where('id', 1).select();

      builder.on('query', function (obj) {
        const native = builder.toSQL().toNative().sql;
        const sql = builder.toSQL().sql;

        //Only assert if they diff to begin with.
        //IE Maria does not diff
        if (native !== sql) {
          expect(obj.sql).to.not.equal(builder.toSQL().toNative().sql);
          expect(obj.sql).to.equal(builder.toSQL().sql);
        }
      });

      return builder;
    });

    describe('async stack traces', function () {
      before(() => {
        knex.client.config.asyncStackTraces = true;
      });
      after(() => {
        delete knex.client.config.asyncStackTraces;
      });
      it('should capture stack trace on raw query', () => {
        return knex.raw('select * from some_nonexisten_table').catch((err) => {
          expect(err.stack.split('\n')[2]).to.match(/at Object\.raw \(/); // the index 2 might need adjustment if the code is refactored
          expect(typeof err.originalStack).to.equal('string');
        });
      });
      it('should capture stack trace on schema builder', () => {
        return knex.schema
          .renameTable('some_nonexisten_table', 'whatever')
          .catch((err) => {
            expect(err.stack.split('\n')[1]).to.match(/client\.schemaBuilder/); // the index 1 might need adjustment if the code is refactored
            expect(typeof err.originalStack).to.equal('string');
          });
      });
    });

    it('Overwrite knex.logger functions using config', () => {
      const knexConfig = _.clone(knex.client.config);

      let callCount = 0;
      const assertCall = function (expectedMessage, message) {
        expect(message).to.equal(expectedMessage);
        callCount++;
      };

      knexConfig.log = {
        warn: assertCall.bind(null, 'test'),
        error: assertCall.bind(null, 'test'),
        debug: assertCall.bind(null, 'test'),
        deprecate: assertCall.bind(
          null,
          'test is deprecated, please use test2'
        ),
      };

      //Sqlite warning message
      knexConfig.useNullAsDefault = true;

      const knexDb = new Knex(knexConfig);

      knexDb.client.logger.warn('test');
      knexDb.client.logger.error('test');
      knexDb.client.logger.debug('test');
      knexDb.client.logger.deprecate('test', 'test2');

      expect(callCount).to.equal(4);
    });
  });
};
