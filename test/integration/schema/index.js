'use strict';

const { expect } = require('chai');

const _ = require('lodash');
const { isString, isObject } = require('../../../lib/util/is');
const {
  isPgBased,
  isMysql,
  isOracle,
  isPostgreSQL,
  isSQLite,
  isRedshift,
  isMssql,
} = require('../../util/db-helpers');

const wrapIdentifier = (value, wrap) => {
  return wrap(value ? value.toUpperCase() : value);
};

function mapObject(obj) {
  return _.transform(
    obj,
    (result, value, key) => {
      result[key.toUpperCase()] = value;
    },
    {}
  );
}

const postProcessResponse = (response) => {
  if (Array.isArray(response)) {
    return response.map(mapObject);
  } else {
    if (isObject(response)) {
      return mapObject(response);
    }
    return response;
  }
};

module.exports = (knex) => {
  describe('Schema', () => {
    describe('errors for unsupported dialects', () => {
      it('throws an error if client does not support createSchema', async function () {
        if (isPgBased(knex)) {
          return this.skip();
        }

        let error;
        try {
          await knex.schema.createSchema('test');
        } catch (e) {
          error = e;
        }
        expect(error.message).to.equal(
          'createSchema is not supported for this dialect (only PostgreSQL supports it currently).'
        );
      });

      it('throws an error if client does not support createSchemaIfNotExists', async function () {
        if (isPgBased(knex)) {
          return this.skip();
        }

        let error;
        try {
          await knex.schema.createSchemaIfNotExists('test');
        } catch (e) {
          error = e;
        }
        expect(error.message).to.equal(
          'createSchemaIfNotExists is not supported for this dialect (only PostgreSQL supports it currently).'
        );
      });

      it('throws an error if client does not support dropSchema', async function () {
        if (isPgBased(knex)) {
          return this.skip();
        }

        let error;
        try {
          await knex.schema.dropSchema('test');
        } catch (e) {
          error = e;
        }
        expect(error.message).to.equal(
          'dropSchema is not supported for this dialect (only PostgreSQL supports it currently).'
        );
      });

      it('throws an error if client does not support dropSchemaIfExists', async function () {
        if (isPgBased(knex)) {
          return this.skip();
        }

        let error;
        try {
          await knex.schema.dropSchemaIfExists('test');
        } catch (e) {
          error = e;
        }
        expect(error.message).to.equal(
          'dropSchemaIfExists is not supported for this dialect (only PostgreSQL supports it currently).'
        );
      });
    });

    describe('dropTable', () => {
      it('has a dropTableIfExists method', function () {
        this.timeout(process.env.KNEX_TEST_TIMEOUT || 30000);
        return Promise.all([
          knex.schema
            .dropTableIfExists('test_foreign_table_two')
            .testSql((tester) => {
              tester(['pg'], ['drop table if exists "test_foreign_table_two"']);
              tester(
                ['pg-redshift'],
                ['drop table if exists "test_foreign_table_two"']
              );
              tester(
                ['sqlite3', 'mysql'],
                ['drop table if exists `test_foreign_table_two`']
              );
              tester('oracledb', [
                'begin execute immediate \'drop table "test_foreign_table_two"\'; exception when others then if sqlcode != -942 then raise; end if; end;',
                'begin execute immediate \'drop sequence "test_foreign_table_two_seq"\'; exception when others then if sqlcode != -2289 then raise; end if; end;',
              ]);
              tester('mssql', [
                "if object_id('[test_foreign_table_two]', 'U') is not null DROP TABLE [test_foreign_table_two]",
              ]);
            }),
          knex.schema
            .dropTableIfExists('test_table_one')
            .dropTableIfExists('catch_test')
            .dropTableIfExists('test_table_two')
            .dropTableIfExists('test_table_three')
            .dropTableIfExists('test_table_four')
            .dropTableIfExists('datatype_test')
            .dropTableIfExists('composite_key_test')
            .dropTableIfExists('charset_collate_test')
            .dropTableIfExists('accounts')
            .dropTableIfExists('migration_test_1')
            .dropTableIfExists('migration_test_2')
            .dropTableIfExists('migration_test_2_1')
            .dropTableIfExists('test_default_table')
            .dropTableIfExists('test_default_table2')
            .dropTableIfExists('test_default_table3')
            .dropTableIfExists('knex_migrations')
            .dropTableIfExists('knex_migrations_lock')
            .dropTableIfExists('bool_test')
            .dropTableIfExists('10_test_table')
            .dropTableIfExists('rename_column_foreign_test')
            .dropTableIfExists('rename_column_test')
            .dropTableIfExists('renamecoltest')
            .dropTableIfExists('should_not_be_run')
            .dropTableIfExists('invalid_inTable_param_test')
            .dropTableIfExists('primarytest')
            .dropTableIfExists('increments_columns_1_test')
            .dropTableIfExists('increments_columns_2_test'),
        ]);
      });
    });

    describe('createTable', () => {
      describe('increments types - postgres', () => {
        if (!isPgBased(knex)) {
          return Promise.resolve();
        }

        before(async () => {
          await knex.schema.createTable(
            'increments_columns_1_test',
            (table) => {
              table.increments().comment('comment_1');
            }
          );
          await knex.schema.createTable(
            'increments_columns_2_test',
            (table) => {
              table.increments('named_2').comment('comment_2');
            }
          );
        });

        after(async () => {
          await knex.schema.dropTable('increments_columns_1_test');
          await knex.schema.dropTable('increments_columns_2_test');
        });

        it('#2210 - creates an incrementing column with a comment', () => {
          const table_name = 'increments_columns_1_test';
          const expected_column = 'id';
          const expected_comment = 'comment_1';

          return knex
            .raw(
              'SELECT c.oid FROM pg_catalog.pg_class c WHERE c.relname = ?',
              [table_name]
            )
            .then((res) => {
              const column_oid = res.rows[0].oid;

              return knex
                .raw('SELECT pg_catalog.col_description(?,?);', [
                  column_oid,
                  '1',
                ])
                .then((_res) => {
                  const comment = _res.rows[0].col_description;

                  return knex
                    .raw(
                      'select column_name from INFORMATION_SCHEMA.COLUMNS where table_name = ?;',
                      table_name
                    )
                    .then((res) => {
                      const column_name = res.rows[0].column_name;

                      expect(column_name).to.equal(expected_column);
                      expect(comment).to.equal(expected_comment);
                    });
                });
            });
        });

        it('#2210 - creates an incrementing column with a specified name and comment', () => {
          const table_name = 'increments_columns_2_test';
          const expected_column = 'named_2';
          const expected_comment = 'comment_2';

          return knex
            .raw(
              'SELECT c.oid FROM pg_catalog.pg_class c WHERE c.relname = ?',
              [table_name]
            )
            .then((res) => {
              const column_oid = res.rows[0].oid;

              return knex
                .raw('SELECT pg_catalog.col_description(?,?);', [
                  column_oid,
                  '1',
                ])
                .then((_res) => {
                  const comment = _res.rows[0].col_description;

                  return knex
                    .raw(
                      'select column_name from INFORMATION_SCHEMA.COLUMNS where table_name = ?;',
                      table_name
                    )
                    .then((res) => {
                      const column_name = res.rows[0].column_name;

                      expect(column_name).to.equal(expected_column);
                      expect(comment).to.equal(expected_comment);
                    });
                });
            });
        });
      });

      describe('increments types - mysql', () => {
        if (!isMysql(knex)) {
          return Promise.resolve();
        }

        before(() =>
          Promise.all([
            knex.schema.createTable('increments_columns_1_test', (table) => {
              table.increments().comment('comment_1');
            }),
            knex.schema.createTable('increments_columns_2_test', (table) => {
              table.increments('named_2').comment('comment_2');
            }),
          ])
        );

        after(() =>
          Promise.all([
            knex.schema.dropTable('increments_columns_1_test'),
            knex.schema.dropTable('increments_columns_2_test'),
          ])
        );

        it('#2210 - creates an incrementing column with a comment', () => {
          const table_name = 'increments_columns_1_test';
          const expected_column = 'id';
          const expected_comment = 'comment_1';

          const query = `
            SELECT
              COLUMN_COMMENT
            FROM
              INFORMATION_SCHEMA.COLUMNS
            WHERE
              TABLE_NAME = ? AND
              COLUMN_NAME = ?
            `;

          return knex.raw(query, [table_name, expected_column]).then((res) => {
            const comment = res[0][0].COLUMN_COMMENT;
            expect(comment).to.equal(expected_comment);
          });
        });

        it('#2210 - creates an incrementing column with a specified name and comment', () => {
          const table_name = 'increments_columns_2_test';
          const expected_column = 'named_2';
          const expected_comment = 'comment_2';

          const query = `
            SELECT
              COLUMN_COMMENT
            FROM
              INFORMATION_SCHEMA.COLUMNS
            WHERE
              TABLE_NAME = ? AND
              COLUMN_NAME = ?
            `;

          return knex.raw(query, [table_name, expected_column]).then((res) => {
            const comment = res[0][0].COLUMN_COMMENT;
            expect(comment).to.equal(expected_comment);
          });
        });
      });

      describe('enum - postgres', () => {
        if (!isPgBased(knex)) {
          return Promise.resolve();
        }

        afterEach(() =>
          knex.schema
            .dropTableIfExists('native_enum_test')
            .raw('DROP TYPE IF EXISTS "foo_type"')
            .raw('DROP SCHEMA IF EXISTS "test" CASCADE')
        );

        it('uses native type with schema', () =>
          knex.schema.createSchemaIfNotExists('test').then(() => {
            return knex.schema
              .withSchema('test')
              .createTable('native_enum_test', (table) => {
                table
                  .enum('foo_column', ['a', 'b', 'c'], {
                    useNative: true,
                    enumName: 'foo_type',
                    schema: true,
                  })
                  .notNull();
                table.uuid('id').notNull();
              })
              .testSql((tester) => {
                tester('pg', [
                  "create type \"test\".\"foo_type\" as enum ('a', 'b', 'c')",
                  'create table "test"."native_enum_test" ("foo_column" "test"."foo_type" not null, "id" uuid not null)',
                ]);
              });
          }));

        it('uses native type when useNative is specified', () =>
          knex.schema
            .createTable('native_enum_test', (table) => {
              table
                .enum('foo_column', ['a', 'b', 'c'], {
                  useNative: true,
                  enumName: 'foo_type',
                })
                .notNull();
              table.uuid('id').notNull();
            })
            .testSql((tester) => {
              tester('pg', [
                "create type \"foo_type\" as enum ('a', 'b', 'c')",
                'create table "native_enum_test" ("foo_column" "foo_type" not null, "id" uuid not null)',
              ]);
            }));

        it('uses an existing native type when useNative and existingType are specified', () =>
          knex
            .raw("create type \"foo_type\" as enum ('a', 'b', 'c')")
            .then(() => {
              return knex.schema
                .createTable('native_enum_test', (table) => {
                  table
                    .enum('foo_column', null, {
                      useNative: true,
                      enumName: 'foo_type',
                      existingType: true,
                    })
                    .notNull();
                  table.uuid('id').notNull();
                })
                .testSql((tester) => {
                  tester('pg', [
                    'create table "native_enum_test" ("foo_column" "foo_type" not null, "id" uuid not null)',
                  ]);
                });
            }));
      });

      it('Callback function must be supplied', () => {
        expect(() => {
          knex.schema.createTable('callback_must_be_supplied').toString();
        }).to.throw(TypeError);
        expect(() => {
          knex.schema
            .createTable('callback_must_be_supplied', () => {})
            .toString();
        }).to.not.throw(TypeError);
      });

      it('is possible to chain .catch', () =>
        knex.schema
          .createTable('catch_test', (t) => {
            t.increments();
          })
          .catch((e) => {
            throw e;
          }));

      it('accepts the table name, and a "container" function', () =>
        knex.schema
          .createTable('test_table_one', (table) => {
            if (isMysql(knex)) table.engine('InnoDB');
            table.comment('A table comment.');
            table.bigIncrements('id');
            table.string('first_name').index();
            table.string('last_name');
            table.string('email').unique().nullable();
            table.integer('logins').defaultTo(1).index().comment();
            table.float('balance').defaultTo(0);
            if (isOracle(knex)) {
              // use string instead to force varchar2 to avoid later problems with join and union
              table.string('about', 4000).comment('A comment.');
            } else {
              table.text('about').comment('A comment.');
            }
            table.timestamps();
          })
          .testSql((tester) => {
            tester('mysql', [
              "create table `test_table_one` (`id` bigint unsigned not null auto_increment primary key, `first_name` varchar(255), `last_name` varchar(255), `email` varchar(255) null, `logins` int default '1', `balance` float(8, 2) default '0', `about` text comment 'A comment.', `created_at` datetime, `updated_at` datetime) default character set utf8 engine = InnoDB comment = 'A table comment.'",
              'alter table `test_table_one` add index `test_table_one_first_name_index`(`first_name`)',
              'alter table `test_table_one` add unique `test_table_one_email_unique`(`email`)',
              'alter table `test_table_one` add index `test_table_one_logins_index`(`logins`)',
            ]);
            tester('pg', [
              'create table "test_table_one" ("id" bigserial primary key, "first_name" varchar(255), "last_name" varchar(255), "email" varchar(255) null, "logins" integer default \'1\', "balance" real default \'0\', "about" text, "created_at" timestamptz, "updated_at" timestamptz)',
              'comment on table "test_table_one" is \'A table comment.\'',
              'comment on column "test_table_one"."logins" is NULL',
              'comment on column "test_table_one"."about" is \'A comment.\'',
              'create index "test_table_one_first_name_index" on "test_table_one" ("first_name")',
              'alter table "test_table_one" add constraint "test_table_one_email_unique" unique ("email")',
              'create index "test_table_one_logins_index" on "test_table_one" ("logins")',
            ]);
            tester('pg-redshift', [
              'create table "test_table_one" ("id" bigint identity(1,1) primary key not null, "first_name" varchar(255), "last_name" varchar(255), "email" varchar(255) null, "logins" integer default \'1\', "balance" real default \'0\', "about" varchar(max), "created_at" timestamptz, "updated_at" timestamptz)',
              'comment on table "test_table_one" is \'A table comment.\'',
              'comment on column "test_table_one"."logins" is NULL',
              'comment on column "test_table_one"."about" is \'A comment.\'',
              'alter table "test_table_one" add constraint "test_table_one_email_unique" unique ("email")',
            ]);
            tester('sqlite3', [
              "create table `test_table_one` (`id` integer not null primary key autoincrement, `first_name` varchar(255), `last_name` varchar(255), `email` varchar(255) null, `logins` integer default '1', `balance` float default '0', `about` text, `created_at` datetime, `updated_at` datetime)",
              'create index `test_table_one_first_name_index` on `test_table_one` (`first_name`)',
              'create unique index `test_table_one_email_unique` on `test_table_one` (`email`)',
              'create index `test_table_one_logins_index` on `test_table_one` (`logins`)',
            ]);
            tester('oracledb', [
              `create table "test_table_one" ("id" number(20, 0) not null primary key, "first_name" varchar2(255), "last_name" varchar2(255), "email" varchar2(255) null, "logins" integer default '1', "balance" float default '0', "about" varchar2(4000), "created_at" timestamp with local time zone, "updated_at" timestamp with local time zone)`,
              'comment on table "test_table_one" is \'A table comment.\'',
              `DECLARE PK_NAME VARCHAR(200); BEGIN  EXECUTE IMMEDIATE ('CREATE SEQUENCE "test_table_one_seq"');  SELECT cols.column_name INTO PK_NAME  FROM all_constraints cons, all_cons_columns cols  WHERE cons.constraint_type = 'P'  AND cons.constraint_name = cols.constraint_name  AND cons.owner = cols.owner  AND cols.table_name = 'test_table_one';  execute immediate ('create or replace trigger "test_table_one_autoinc_trg"  BEFORE INSERT on "test_table_one"  for each row  declare  checking number := 1;  begin    if (:new."' || PK_NAME || '" is null) then      while checking >= 1 loop        select "test_table_one_seq".nextval into :new."' || PK_NAME || '" from dual;        select count("' || PK_NAME || '") into checking from "test_table_one"        where "' || PK_NAME || '" = :new."' || PK_NAME || '";      end loop;    end if;  end;'); END;`,
              'comment on column "test_table_one"."logins" is \'\'',
              'comment on column "test_table_one"."about" is \'A comment.\'',
              'create index "NkZo/dGRI9O73/NE2fHo+35d4jk" on "test_table_one" ("first_name")',
              'alter table "test_table_one" add constraint "test_table_one_email_unique" unique ("email")',
              'create index "test_table_one_logins_index" on "test_table_one" ("logins")',
            ]);
            tester('mssql', [
              "CREATE TABLE [test_table_one] ([id] bigint identity(1,1) not null primary key, [first_name] nvarchar(255), [last_name] nvarchar(255), [email] nvarchar(255) null, [logins] int CONSTRAINT [test_table_one_logins_default] DEFAULT '1', [balance] float CONSTRAINT [test_table_one_balance_default] DEFAULT '0', [about] nvarchar(max), [created_at] datetime2, [updated_at] datetime2)",
              'CREATE INDEX [test_table_one_first_name_index] ON [test_table_one] ([first_name])',
              'CREATE UNIQUE INDEX [test_table_one_email_unique] ON [test_table_one] ([email]) WHERE [email] IS NOT NULL',
              'CREATE INDEX [test_table_one_logins_index] ON [test_table_one] ([logins])',
            ]);
          }));

      it('is possible to set the db engine with the table.engine', () =>
        knex.schema
          .createTable('test_table_two', (table) => {
            if (isMysql(knex)) {
              table.engine('InnoDB');
            }
            table.increments();
            table.integer('account_id');
            if (isOracle(knex)) {
              // use string instead to force varchar2 to avoid later problems with join and union
              // e.g. where email (varchar2) = details (clob) does not work
              table.string('details', 4000);
            } else {
              table.text('details');
            }
            table.tinyint('status');
          })
          .testSql((tester) => {
            tester('mysql', [
              'create table `test_table_two` (`id` int unsigned not null auto_increment primary key, `account_id` int, `details` text, `status` tinyint) default character set utf8 engine = InnoDB',
            ]);
          }));

      it('sets default values with defaultTo', () => {
        const defaultMetadata = { a: 10 };
        const defaultDetails = { b: { d: 20 } };
        return knex.schema
          .createTable('test_table_three', (table) => {
            if (isMysql(knex)) {
              table.engine('InnoDB');
            }
            table.integer('main').notNullable().primary();
            table.text('paragraph').defaultTo('Lorem ipsum Qui quis qui in.');
            table.json('metadata').defaultTo(defaultMetadata);
            if (isPostgreSQL(knex)) {
              table.jsonb('details').defaultTo(defaultDetails);
            }
          })
          .testSql((tester) => {
            tester('mysql', [
              'create table `test_table_three` (`main` int not null, `paragraph` text, `metadata` json default (\'{"a":10}\')) default character set utf8 engine = InnoDB',
              'alter table `test_table_three` add primary key `test_table_three_pkey`(`main`)',
            ]);
            tester('pg', [
              'create table "test_table_three" ("main" integer not null, "paragraph" text default \'Lorem ipsum Qui quis qui in.\', "metadata" json default \'{"a":10}\', "details" jsonb default \'{"b":{"d":20}}\')',
              'alter table "test_table_three" add constraint "test_table_three_pkey" primary key ("main")',
            ]);
            tester('pg-redshift', [
              'create table "test_table_three" ("main" integer not null, "paragraph" varchar(max) default \'Lorem ipsum Qui quis qui in.\',  "metadata" json default \'{"a":10}\', "details" jsonb default \'{"b":{"d":20}}\')',
              'alter table "test_table_three" add constraint "test_table_three_pkey" primary key ("main")',
            ]);
            tester('sqlite3', [
              "create table `test_table_three` (`main` integer not null, `paragraph` text default 'Lorem ipsum Qui quis qui in.', `metadata` json default '{\"a\":10}', primary key (`main`))",
            ]);
            tester('oracledb', [
              'create table "test_table_three" ("main" integer not null, "paragraph" clob default \'Lorem ipsum Qui quis qui in.\', "metadata" clob default \'{"a":10}\')',
              'alter table "test_table_three" add constraint "test_table_three_pkey" primary key ("main")',
            ]);
            tester('mssql', [
              "CREATE TABLE [test_table_three] ([main] int not null, [paragraph] nvarchar(max) CONSTRAINT [test_table_three_paragraph_default] DEFAULT 'Lorem ipsum Qui quis qui in.', [metadata] nvarchar(max) CONSTRAINT [test_table_three_metadata_default] DEFAULT '{\"a\":10}', CONSTRAINT [test_table_three_pkey] PRIMARY KEY ([main]))",
            ]);
          })
          .then(() =>
            knex('test_table_three').insert([
              {
                main: 1,
              },
            ])
          )
          .then(() => knex('test_table_three').where({ main: 1 }).first())
          .then((result) => {
            expect(result.main).to.equal(1);
            if (!isMysql(knex)) {
              // MySQL doesn't support default values in text columns
              expect(result.paragraph).to.eql('Lorem ipsum Qui quis qui in.');
              return;
            }
            if (isPostgreSQL(knex)) {
              expect(result.metadata).to.eql(defaultMetadata);
              expect(result.details).to.eql(defaultDetails);
            } else if (isString(result.metadata)) {
              expect(JSON.parse(result.metadata)).to.eql(defaultMetadata);
            } else {
              expect(result.metadata).to.eql(defaultMetadata);
            }
          });
      });

      it('handles numeric length correctly', () =>
        knex.schema
          .createTable('test_table_numerics', (table) => {
            if (isMysql(knex)) {
              table.engine('InnoDB');
            }
            table.integer('integer_column', 5);
            table.tinyint('tinyint_column', 5);
            table.smallint('smallint_column', 5);
            table.mediumint('mediumint_column', 5);
            table.bigint('bigint_column', 5);
          })
          .testSql((tester) => {
            tester('mysql', [
              'create table `test_table_numerics` (`integer_column` int(5), `tinyint_column` tinyint(5), `smallint_column` smallint, `mediumint_column` mediumint, `bigint_column` bigint) default character set utf8 engine = InnoDB',
            ]);
            tester('pg', [
              'create table "test_table_numerics" ("integer_column" integer, "tinyint_column" smallint, "smallint_column" smallint, "mediumint_column" integer, "bigint_column" bigint)',
            ]);
            tester('sqlite3', [
              'create table `test_table_numerics` (`integer_column` integer, `tinyint_column` tinyint, `smallint_column` integer, `mediumint_column` integer, `bigint_column` bigint)',
            ]);
            tester('mssql', [
              'CREATE TABLE [test_table_numerics] ([integer_column] int, [tinyint_column] tinyint, [smallint_column] smallint, [mediumint_column] int, [bigint_column] bigint)',
            ]);
          })
          .then(() => knex.schema.dropTable('test_table_numerics')));

      it('supports the enum and uuid columns', () => {
        // NB: redshift does not...
        return knex.schema
          .createTable('datatype_test', (table) => {
            table.enum('enum_value', ['a', 'b', 'c']);
            table.uuid('uuid').notNull();
          })
          .testSql((tester) => {
            tester('mysql', [
              "create table `datatype_test` (`enum_value` enum('a', 'b', 'c'), `uuid` char(36) not null) default character set utf8",
            ]);
            tester('pg', [
              'create table "datatype_test" ("enum_value" text check ("enum_value" in (\'a\', \'b\', \'c\')), "uuid" uuid not null)',
            ]);
            tester('sqlite3', [
              "create table `datatype_test` (`enum_value` text check (`enum_value` in ('a', 'b', 'c')), `uuid` char(36) not null)",
            ]);
            tester('oracledb', [
              'create table "datatype_test" ("enum_value" varchar2(1) check ("enum_value" in (\'a\', \'b\', \'c\')), "uuid" char(36) not null)',
            ]);
            tester('mssql', [
              'CREATE TABLE [datatype_test] ([enum_value] nvarchar(100), [uuid] uniqueidentifier not null)',
            ]);
          });
      });

      it('allows for setting foreign keys on schema creation', () =>
        knex.schema
          .createTable('test_foreign_table_two', (table) => {
            table.increments();
            table
              .integer('fkey_two')
              .unsigned()
              .references('id')
              .inTable('test_table_two');
            table
              .integer('fkey_three')
              .unsigned()
              .references('id')
              .inTable('test_table_two')
              .withKeyName('fk_fkey_three');
            table.integer('fkey_four').unsigned();
            table
              .foreign('fkey_four', 'fk_fkey_four')
              .references('test_table_two.id');
          })
          .testSql((tester) => {
            tester('mysql', [
              'create table `test_foreign_table_two` (`id` int unsigned not null auto_increment primary key, `fkey_two` int unsigned, `fkey_three` int unsigned, `fkey_four` int unsigned) default character set utf8',
              'alter table `test_foreign_table_two` add constraint `test_foreign_table_two_fkey_two_foreign` foreign key (`fkey_two`) references `test_table_two` (`id`)',
              'alter table `test_foreign_table_two` add constraint `fk_fkey_three` foreign key (`fkey_three`) references `test_table_two` (`id`)',
              'alter table `test_foreign_table_two` add constraint `fk_fkey_four` foreign key (`fkey_four`) references `test_table_two` (`id`)',
            ]);
            tester('pg', [
              'create table "test_foreign_table_two" ("id" serial primary key, "fkey_two" integer, "fkey_three" integer, "fkey_four" integer)',
              'alter table "test_foreign_table_two" add constraint "test_foreign_table_two_fkey_two_foreign" foreign key ("fkey_two") references "test_table_two" ("id")',
              'alter table "test_foreign_table_two" add constraint "fk_fkey_three" foreign key ("fkey_three") references "test_table_two" ("id")',
              'alter table "test_foreign_table_two" add constraint "fk_fkey_four" foreign key ("fkey_four") references "test_table_two" ("id")',
            ]);
            tester('pg-redshift', [
              'create table "test_foreign_table_two" ("id" integer identity(1,1) primary key not null, "fkey_two" integer, "fkey_three" integer, "fkey_four" integer)',
              'alter table "test_foreign_table_two" add constraint "test_foreign_table_two_fkey_two_foreign" foreign key ("fkey_two") references "test_table_two" ("id")',
              'alter table "test_foreign_table_two" add constraint "fk_fkey_three" foreign key ("fkey_three") references "test_table_two" ("id")',
              'alter table "test_foreign_table_two" add constraint "fk_fkey_four" foreign key ("fkey_four") references "test_table_two" ("id")',
            ]);
            tester('sqlite3', [
              'create table `test_foreign_table_two` (`id` integer not null primary key autoincrement, `fkey_two` integer, `fkey_three` integer, `fkey_four` integer, ' +
                'foreign key(`fkey_two`) references `test_table_two`(`id`), ' +
                'constraint `fk_fkey_three` foreign key(`fkey_three`) references `test_table_two`(`id`), ' +
                'constraint `fk_fkey_four` foreign key(`fkey_four`) references `test_table_two`(`id`))',
            ]);
            tester('oracledb', [
              'create table "test_foreign_table_two" ("id" integer not null primary key, "fkey_two" integer, "fkey_three" integer, "fkey_four" integer)',
              'DECLARE PK_NAME VARCHAR(200); BEGIN  EXECUTE IMMEDIATE (\'CREATE SEQUENCE "test_foreign_table_two_seq"\');  SELECT cols.column_name INTO PK_NAME  FROM all_constraints cons, all_cons_columns cols  WHERE cons.constraint_type = \'P\'  AND cons.constraint_name = cols.constraint_name  AND cons.owner = cols.owner  AND cols.table_name = \'test_foreign_table_two\';  execute immediate (\'create or replace trigger "m6uvAnbUQqcHvfWTN5IAjip1/vk"  BEFORE INSERT on "test_foreign_table_two"  for each row  declare  checking number := 1;  begin    if (:new."\' || PK_NAME || \'" is null) then      while checking >= 1 loop        select "test_foreign_table_two_seq".nextval into :new."\' || PK_NAME || \'" from dual;        select count("\' || PK_NAME || \'") into checking from "test_foreign_table_two"        where "\' || PK_NAME || \'" = :new."\' || PK_NAME || \'";      end loop;    end if;  end;\'); END;',
              'alter table "test_foreign_table_two" add constraint "q7TfvbIx3HUQbh+l+e5N+J+Guag" foreign key ("fkey_two") references "test_table_two" ("id")',
              'alter table "test_foreign_table_two" add constraint "fk_fkey_three" foreign key ("fkey_three") references "test_table_two" ("id")',
              'alter table "test_foreign_table_two" add constraint "fk_fkey_four" foreign key ("fkey_four") references "test_table_two" ("id")',
            ]);
            tester('mssql', [
              'CREATE TABLE [test_foreign_table_two] ([id] int identity(1,1) not null primary key, [fkey_two] int, [fkey_three] int, [fkey_four] int, ' +
                'CONSTRAINT [test_foreign_table_two_fkey_two_foreign] FOREIGN KEY ([fkey_two]) REFERENCES [test_table_two] ([id]), ' +
                'CONSTRAINT [fk_fkey_three] FOREIGN KEY ([fkey_three]) REFERENCES [test_table_two] ([id]), ' +
                'CONSTRAINT [fk_fkey_four] FOREIGN KEY ([fkey_four]) REFERENCES [test_table_two] ([id]))',
            ]);
          }));

      it('rejects setting foreign key where tableName is not typeof === string', () => {
        const builder = knex.schema.createTable(
          'invalid_inTable_param_test',
          (table) => {
            const createInvalidUndefinedInTableSchema = () => {
              table.increments('id').references('id').inTable();
            };
            const createInvalidObjectInTableSchema = () => {
              table
                .integer('another_id')
                .references('id')
                .inTable({ tableName: 'this_should_fail' });
            };
            expect(createInvalidUndefinedInTableSchema).to.throw(TypeError);
            expect(createInvalidObjectInTableSchema).to.throw(TypeError);

            table
              .integer('yet_another_id')
              .references('id')
              .inTable({ tableName: 'this_should_fail_too' });
          }
        );

        expect(() => builder.toSQL()).to.throw(TypeError);
      });

      it('allows for composite keys', () =>
        knex.schema
          .createTable('composite_key_test', (table) => {
            table.integer('column_a');
            table.integer('column_b');
            table.text('details');
            table.tinyint('status');
            table.unique(['column_a', 'column_b']);
          })
          .testSql((tester) => {
            tester('mysql', [
              'create table `composite_key_test` (`column_a` int, `column_b` int, `details` text, `status` tinyint) default character set utf8',
              'alter table `composite_key_test` add unique `composite_key_test_column_a_column_b_unique`(`column_a`, `column_b`)',
            ]);
            tester('pg', [
              'create table "composite_key_test" ("column_a" integer, "column_b" integer, "details" text, "status" smallint)',
              'alter table "composite_key_test" add constraint "composite_key_test_column_a_column_b_unique" unique ("column_a", "column_b")',
            ]);
            tester('pg-redshift', [
              'create table "composite_key_test" ("column_a" integer, "column_b" integer, "details" varchar(max), "status" smallint)',
              'alter table "composite_key_test" add constraint "composite_key_test_column_a_column_b_unique" unique ("column_a", "column_b")',
            ]);
            tester('sqlite3', [
              'create table `composite_key_test` (`column_a` integer, `column_b` integer, `details` text, `status` tinyint)',
              'create unique index `composite_key_test_column_a_column_b_unique` on `composite_key_test` (`column_a`, `column_b`)',
            ]);
            tester('oracledb', [
              'create table "composite_key_test" ("column_a" integer, "column_b" integer, "details" clob, "status" smallint)',
              'alter table "composite_key_test" add constraint "zYmMt0VQwlLZ20XnrMicXZ0ufZk" unique ("column_a", "column_b")',
            ]);
            tester('mssql', [
              'CREATE TABLE [composite_key_test] ([column_a] int, [column_b] int, [details] nvarchar(max), [status] tinyint)',
              'CREATE UNIQUE INDEX [composite_key_test_column_a_column_b_unique] ON [composite_key_test] ([column_a], [column_b]) WHERE [column_a] IS NOT NULL AND [column_b] IS NOT NULL',
            ]);
          })
          .then(() =>
            knex('composite_key_test').insert([
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
              {
                column_a: 1,
                column_b: 3,
                details: 'One, Three, Zero',
                status: 0,
              },
            ])
          ));

      it('is possible to set the table collation with table.charset and table.collate', () =>
        knex.schema
          .createTable('charset_collate_test', (table) => {
            if (isMysql(knex)) {
              table.charset('latin1');
              table.collate('latin1_general_ci');
              table.engine('InnoDB');
            }
            table.increments();
            table.integer('account_id');
            table.text('details');
            table.tinyint('status');
          })
          .testSql((tester) => {
            tester('mysql', [
              'create table `charset_collate_test` (`id` int unsigned not null auto_increment primary key, `account_id` int, `details` text, `status` tinyint) default character set latin1 collate latin1_general_ci engine = InnoDB',
            ]);
            tester('pg', [
              'create table "charset_collate_test" ("id" serial primary key, "account_id" integer, "details" text, "status" smallint)',
            ]);
            tester('pg-redshift', [
              'create table "charset_collate_test" ("id" integer identity(1,1) primary key not null, "account_id" integer, "details" varchar(max), "status" smallint)',
            ]);
            tester('sqlite3', [
              'create table `charset_collate_test` (`id` integer not null primary key autoincrement, `account_id` integer, `details` text, `status` tinyint)',
            ]);
            tester('oracledb', [
              'create table "charset_collate_test" ("id" integer not null primary key, "account_id" integer, "details" clob, "status" smallint)',
              'DECLARE PK_NAME VARCHAR(200); BEGIN  EXECUTE IMMEDIATE (\'CREATE SEQUENCE "charset_collate_test_seq"\');  SELECT cols.column_name INTO PK_NAME  FROM all_constraints cons, all_cons_columns cols  WHERE cons.constraint_type = \'P\'  AND cons.constraint_name = cols.constraint_name  AND cons.owner = cols.owner  AND cols.table_name = \'charset_collate_test\';  execute immediate (\'create or replace trigger "x9C3VzXH9urIKnTjm32JM7OvYYQ"  BEFORE INSERT on "charset_collate_test"  for each row  declare  checking number := 1;  begin    if (:new."\' || PK_NAME || \'" is null) then      while checking >= 1 loop        select "charset_collate_test_seq".nextval into :new."\' || PK_NAME || \'" from dual;        select count("\' || PK_NAME || \'") into checking from "charset_collate_test"        where "\' || PK_NAME || \'" = :new."\' || PK_NAME || \'";      end loop;    end if;  end;\'); END;',
            ]);
            tester('mssql', [
              'CREATE TABLE [charset_collate_test] ([id] int identity(1,1) not null primary key, [account_id] int, [details] nvarchar(max), [status] tinyint)',
            ]);
          }));

      it('sets booleans & defaults correctly', () =>
        knex.schema
          .createTable('bool_test', (table) => {
            table.bool('one');
            table.bool('two').defaultTo(false);
            table.bool('three').defaultTo(true);
            table.bool('four').defaultTo('true');
            table.bool('five').defaultTo('false');
          })
          .testSql((tester) => {
            tester('mysql', [
              "create table `bool_test` (`one` boolean, `two` boolean default '0', `three` boolean default '1', `four` boolean default '1', `five` boolean default '0') default character set utf8",
            ]);
            tester('pg', [
              'create table "bool_test" ("one" boolean, "two" boolean default \'0\', "three" boolean default \'1\', "four" boolean default \'1\', "five" boolean default \'0\')',
            ]);
            tester('pg-redshift', [
              'create table "bool_test" ("one" boolean, "two" boolean default \'0\', "three" boolean default \'1\', "four" boolean default \'1\', "five" boolean default \'0\')',
            ]);
            tester('sqlite3', [
              "create table `bool_test` (`one` boolean, `two` boolean default '0', `three` boolean default '1', `four` boolean default '1', `five` boolean default '0')",
            ]);
            tester('oracledb', [
              "create table \"bool_test\" (\"one\" number(1, 0) check (\"one\" in ('0', '1')), \"two\" number(1, 0) default '0' check (\"two\" in ('0', '1')), \"three\" number(1, 0) default '1' check (\"three\" in ('0', '1')), \"four\" number(1, 0) default '1' check (\"four\" in ('0', '1')), \"five\" number(1, 0) default '0' check (\"five\" in ('0', '1')))",
            ]);
            tester('mssql', [
              "CREATE TABLE [bool_test] ([one] bit, [two] bit CONSTRAINT [bool_test_two_default] DEFAULT '0', [three] bit CONSTRAINT [bool_test_three_default] DEFAULT '1', [four] bit CONSTRAINT [bool_test_four_default] DEFAULT '1', [five] bit CONSTRAINT [bool_test_five_default] DEFAULT '0')",
            ]);
          })
          .then(() => knex.insert({ one: false }).into('bool_test')));

      it('accepts table names starting with numeric values', () =>
        knex.schema
          .createTable('10_test_table', (table) => {
            table.bigIncrements('id');
            table.string('first_name').index();
            table.string('last_name');
            table.string('email').unique().nullable();
            table.integer('logins').defaultTo(1).index().comment();
          })
          .testSql((tester) => {
            tester('mysql', [
              "create table `10_test_table` (`id` bigint unsigned not null auto_increment primary key, `first_name` varchar(255), `last_name` varchar(255), `email` varchar(255) null, `logins` int default '1') default character set utf8",
              'alter table `10_test_table` add index `10_test_table_first_name_index`(`first_name`)',
              'alter table `10_test_table` add unique `10_test_table_email_unique`(`email`)',
              'alter table `10_test_table` add index `10_test_table_logins_index`(`logins`)',
            ]);
            tester('pg', [
              'create table "10_test_table" ("id" bigserial primary key, "first_name" varchar(255), "last_name" varchar(255), "email" varchar(255) null, "logins" integer default \'1\')',
              'comment on column "10_test_table"."logins" is NULL',
              'create index "10_test_table_first_name_index" on "10_test_table" ("first_name")',
              'alter table "10_test_table" add constraint "10_test_table_email_unique" unique ("email")',
              'create index "10_test_table_logins_index" on "10_test_table" ("logins")',
            ]);
            tester('sqlite3', [
              "create table `10_test_table` (`id` integer not null primary key autoincrement, `first_name` varchar(255), `last_name` varchar(255), `email` varchar(255) null, `logins` integer default '1')",
              'create index `10_test_table_first_name_index` on `10_test_table` (`first_name`)',
              'create unique index `10_test_table_email_unique` on `10_test_table` (`email`)',
              'create index `10_test_table_logins_index` on `10_test_table` (`logins`)',
            ]);
            tester('oracledb', [
              'create table "10_test_table" ("id" number(20, 0) not null primary key, "first_name" varchar2(255), "last_name" varchar2(255), "email" varchar2(255) null, "logins" integer default \'1\')',
              'DECLARE PK_NAME VARCHAR(200); BEGIN  EXECUTE IMMEDIATE (\'CREATE SEQUENCE "10_test_table_seq"\');  SELECT cols.column_name INTO PK_NAME  FROM all_constraints cons, all_cons_columns cols  WHERE cons.constraint_type = \'P\'  AND cons.constraint_name = cols.constraint_name  AND cons.owner = cols.owner  AND cols.table_name = \'10_test_table\';  execute immediate (\'create or replace trigger "10_test_table_autoinc_trg"  BEFORE INSERT on "10_test_table"  for each row  declare  checking number := 1;  begin    if (:new."\' || PK_NAME || \'" is null) then      while checking >= 1 loop        select "10_test_table_seq".nextval into :new."\' || PK_NAME || \'" from dual;        select count("\' || PK_NAME || \'") into checking from "10_test_table"        where "\' || PK_NAME || \'" = :new."\' || PK_NAME || \'";      end loop;    end if;  end;\'); END;',
              'comment on column "10_test_table"."logins" is \'\'',
              'create index "10_test_table_first_name_index" on "10_test_table" ("first_name")',
              'alter table "10_test_table" add constraint "10_test_table_email_unique" unique ("email")',
              'create index "10_test_table_logins_index" on "10_test_table" ("logins")',
            ]);
          }));
    });

    describe('table', () => {
      it('Callback function must be supplied', () => {
        expect(() => {
          knex.schema.createTable('callback_must_be_supplied').toString();
        }).to.throw(TypeError);
        expect(() => {
          knex.schema
            .createTable('callback_must_be_supplied', () => {})
            .toString();
        }).to.not.throw(TypeError);
      });

      it('allows adding a field', () =>
        knex.schema.table('test_table_two', (t) => {
          t.json('json_data', true);
        }));

      it('allows adding multiple columns at once', function () {
        if (isRedshift(knex)) {
          return this.skip();
        }
        return knex.schema
          .table('test_table_two', (t) => {
            t.string('one');
            t.string('two');
            t.string('three');
          })
          .then(() =>
            knex.schema.table('test_table_two', (t) => {
              t.dropColumn('one');
              t.dropColumn('two');
              t.dropColumn('three');
            })
          );
      });

      it('handles creating numeric columns with specified length correctly', () =>
        knex.schema
          .createTable('test_table_numerics2', (table) => {
            table.integer('integer_column', 5);
            table.tinyint('tinyint_column', 5);
            table.smallint('smallint_column', 5);
            table.mediumint('mediumint_column', 5);
            table.bigint('bigint_column', 5);
          })
          .then(() => knex.schema.dropTable('test_table_numerics2')));

      it('allows alter column syntax', function () {
        if (
          isSQLite(knex) ||
          isRedshift(knex) ||
          isMssql(knex) ||
          isOracle(knex)
        ) {
          return;
        }

        return knex.schema
          .table('test_table_two', (t) => {
            t.integer('remove_not_null').notNull().defaultTo(1);
            t.string('remove_default').notNull().defaultTo(1);
            t.dateTime('datetime_to_date').notNull().defaultTo(knex.fn.now());
          })
          .then(() =>
            knex.schema.table('test_table_two', (t) => {
              t.integer('remove_not_null').defaultTo(1).alter();
              t.integer('remove_default').notNull().alter();
              t.date('datetime_to_date').alter();
            })
          )
          .then(() => knex('test_table_two').columnInfo())
          .then((info) => {
            expect(info.remove_not_null.nullable).to.equal(true);
            expect(info.remove_not_null.defaultValue).to.not.equal(null);
            expect(info.remove_default.nullable).to.equal(false);
            expect(info.remove_default.defaultValue).to.equal(null);
            expect(info.remove_default.type).to.contains('int');
            return knex.schema.table('test_table_two', (t) => {
              t.dropColumn('remove_default');
              t.dropColumn('remove_not_null');
              t.dropColumn('datetime_to_date');
            });
          });
      });

      it('allows adding a field with custom collation after another field', () =>
        knex.schema
          .table('test_table_two', (t) => {
            t.string('ref_column').after('json_data');
          })
          .then(() =>
            knex.schema.table('test_table_two', (t) => {
              t.string('after_column').after('ref_column').collate('utf8_bin');
            })
          )
          .then(() =>
            knex.schema.table('test_table_two', (t) => {
              t.dropColumn('ref_column');
              t.dropColumn('after_column');
            })
          ));

      it('allows adding a field with custom collation first', () =>
        knex.schema
          .table('test_table_two', (t) => {
            t.string('first_column').first().collate('utf8_bin');
          })
          .then(() =>
            knex.schema.table('test_table_two', (t) => {
              t.dropColumn('first_column');
            })
          ));

      it('allows changing a field', () =>
        knex.schema.table('test_table_one', (t) => {
          t.string('phone').nullable();
        }));

      it('allows dropping a unique index', () =>
        knex.schema.table('composite_key_test', (t) => {
          t.dropUnique(['column_a', 'column_b']);
        }));

      it('allows dropping a index', () =>
        knex.schema.table('test_table_one', (t) => {
          t.dropIndex('first_name');
        }));
    });

    describe('hasTable', () => {
      it('checks whether a table exists', () =>
        knex.schema.hasTable('test_table_two').then((resp) => {
          expect(resp).to.equal(true);
        }));

      it('should be false if a table does not exists', () =>
        knex.schema.hasTable('this_table_is_fake').then((resp) => {
          expect(resp).to.equal(false);
        }));

      it('should be false whether a parameter is not specified', () =>
        knex.schema.hasTable('').then((resp) => {
          expect(resp).to.equal(false);
        }));
    });

    describe('renameTable', () => {
      it('renames the table from one to another', () =>
        knex.schema.renameTable('test_table_one', 'accounts'));
    });

    describe('dropTable', () => {
      it('should drop a table', () =>
        knex.schema.dropTable('test_table_three').then(() => {
          // Drop this here so we don't have foreign key constraints...
          return knex.schema.dropTable('test_foreign_table_two');
        }));
    });

    describe('hasColumn', () => {
      describe('without processors', () => {
        it('checks whether a column exists, resolving with a boolean', () =>
          knex.schema.hasColumn('accounts', 'first_name').then((exists) => {
            expect(exists).to.equal(true);
          }));

        describe('sqlite only', () => {
          if (!isSQLite(knex)) {
            return Promise.resolve();
          }

          it('checks whether a column exists without being case sensitive, resolving with a boolean', async () => {
            const exists = await knex.schema.hasColumn(
              'accounts',
              'FIRST_NAME'
            );

            expect(exists).to.equal(true);
          });
        });
      });

      describe('using processorss', () => {
        describe('sqlite and pg only', () => {
          if (!isSQLite(knex) && !isPostgreSQL(knex)) {
            return Promise.resolve();
          }

          beforeEach(() => {
            knex.client.config.postProcessResponse = postProcessResponse;
            knex.client.config.wrapIdentifier = wrapIdentifier;
          });

          afterEach(() => {
            knex.client.config.postProcessResponse = null;
            knex.client.config.wrapIdentifier = null;
          });

          it('checks whether a column exists, resolving with a boolean', () =>
            knex.schema.hasColumn('accounts', 'firstName').then((exists) => {
              expect(exists).to.equal(false);
            }));
        });
      });
    });

    describe('addColumn', () => {
      describe('mysql only', () => {
        if (!isMysql(knex)) {
          return Promise.resolve(true);
        }

        before(() =>
          knex.schema
            .createTable('add_column_test_mysql', (tbl) => {
              tbl.integer('field_foo');
              tbl.integer('field_bar');
            })
            .then(() =>
              knex.schema.alterTable('add_column_test_mysql', (tbl) => {
                tbl.integer('field_foo').comment('foo').alter();
                tbl.integer('field_bar').comment('bar').alter();
                tbl.integer('field_first').first().comment('First');
                tbl
                  .integer('field_after_foo')
                  .after('field_foo')
                  .comment('After');
                tbl
                  .increments('field_nondefault_increments')
                  .comment('Comment on increment col');
              })
            )
        );

        after(() => knex.schema.dropTable('add_column_test_mysql'));

        it('should columns order be correctly with after and first', () =>
          knex
            .raw('SHOW CREATE TABLE `add_column_test_mysql`')
            .then((schema) => {
              // .columnInfo() keys does not guaranteed fields order.
              const fields = schema[0][0]['Create Table']
                .split('\n')
                .filter((e) => e.trim().indexOf('`field_') === 0)
                .map((e) => e.trim())
                .map((e) => e.slice(1, e.slice(1).indexOf('`') + 1));

              // Fields order
              expect(fields[0]).to.equal('field_first');
              expect(fields[1]).to.equal('field_foo');
              expect(fields[2]).to.equal('field_after_foo');
              expect(fields[3]).to.equal('field_bar');
              expect(fields[4]).to.equal('field_nondefault_increments');

              // .columnInfo() does not included fields comment.
              const comments = schema[0][0]['Create Table']
                .split('\n')
                .filter((e) => e.trim().indexOf('`field_') === 0)
                .map((e) => e.slice(e.indexOf("'")).trim())
                .map((e) => e.slice(1, e.slice(1).indexOf("'") + 1));

              // Fields comment
              expect(comments[0]).to.equal('First');
              expect(comments[1]).to.equal('foo');
              expect(comments[2]).to.equal('After');
              expect(comments[3]).to.equal('bar');
              expect(comments[4]).to.equal('Comment on increment col');
            }));
      });
    });

    describe('renameColumn', () => {
      describe('without mappers', () => {
        before(async () => {
          await knex.schema
            .createTable('rename_column_test', (tbl) => {
              tbl.increments('id_test').unsigned().primary();
              tbl
                .integer('parent_id_test')
                .unsigned()
                .references('id_test')
                .inTable('rename_column_test');
            })
            .createTable('rename_column_foreign_test', (tbl) => {
              tbl.increments('id').unsigned().primary();
              tbl
                .integer('foreign_id_test')
                .unsigned()
                .references('id_test')
                .inTable('rename_column_test');
            })
            .createTable('rename_col_test', (tbl) => {
              tbl.integer('colnameint').defaultTo(1);
              tbl.string('colnamestring').defaultTo('knex').notNullable();
            });
        });

        after(async () => {
          await knex.schema
            .dropTable('rename_column_foreign_test')
            .dropTable('rename_column_test')
            .dropTable('rename_col_test');
        });

        it('renames the column', async () => {
          await knex.schema.table('rename_column_test', (tbl) =>
            tbl.renameColumn('id_test', 'id')
          );
          const exists = await knex.schema.hasColumn(
            'rename_column_test',
            'id'
          );
          expect(exists).to.equal(true);
        });

        it('successfully renames a column referenced in a foreign key', () =>
          knex.schema.table('rename_column_test', (tbl) => {
            tbl.renameColumn('parent_id_test', 'parent_id');
          }));

        it('successfully renames a column referenced by another table', () =>
          knex.schema.table('rename_column_test', (tbl) => {
            tbl.renameColumn('id', 'id_new');
          }));

        it('#933 - .renameColumn should not drop null or default value', () => {
          const tableName = 'rename_col_test';
          return knex.transaction((tr) => {
            const getColInfo = () => tr(tableName).columnInfo();
            return getColInfo()
              .then((colInfo) => {
                expect(String(colInfo.colnameint.defaultValue)).to.contain('1');
                // Using contain because of different response per dialect.
                // IE mysql 'knex', postgres 'knex::character varying'
                expect(colInfo.colnamestring.defaultValue).to.contain('knex');
                expect(colInfo.colnamestring.nullable).to.equal(false);
                return tr.schema.table(tableName, (table) => {
                  table.renameColumn('colnameint', 'colnameintchanged');
                  table.renameColumn('colnamestring', 'colnamestringchanged');
                });
              })
              .then(getColInfo)
              .then((columnInfo) => {
                expect(
                  String(columnInfo.colnameintchanged.defaultValue)
                ).to.contain('1');
                expect(columnInfo.colnamestringchanged.defaultValue).to.contain(
                  'knex'
                );
                expect(columnInfo.colnamestringchanged.nullable).to.equal(
                  false
                );
              });
          });
        });

        it('#2767 - .renameColumn should not drop the auto incremental', () => {
          const tableName = 'rename_column_test';

          if (isMssql(knex)) {
            return knex
              .raw(
                `select COLUMNPROPERTY(object_id(TABLE_SCHEMA+'.'+TABLE_NAME), COLUMN_NAME, 'IsIdentity') as Ident from INFORMATION_SCHEMA.COLUMNS where TABLE_NAME =? AND COLUMN_NAME = ?;`,
                [tableName, 'id_new']
              )
              .then((res) => {
                const autoinc = res[0].Ident;
                expect(autoinc).to.equal(1);
              });
          } else if (isMysql(knex)) {
            return knex.raw(`show fields from ${tableName}`).then((res) => {
              const autoinc = res[0][0].Extra;
              expect(autoinc).to.equal('auto_increment');
            });
          } else if (isPgBased(knex)) {
            return knex
              .raw(
                `select pg_get_serial_sequence(table_name, column_name) as ident from INFORMATION_SCHEMA.COLUMNS where table_name =? AND column_name = ?;`,
                [tableName, 'id_new']
              )
              .then((res) => {
                const autoinc = !!res.rows[0].ident;
                expect(autoinc).to.equal(true);
              });
          } else if (isSQLite(knex)) {
            return knex
              .raw(
                `SELECT "is-autoincrement" as ident FROM sqlite_master WHERE tbl_name=? AND sql LIKE "%AUTOINCREMENT%"`,
                [tableName]
              )
              .then((res) => {
                const autoinc = !!res[0].ident;
                expect(autoinc).to.equal(true);
              });
          }

          return Promise.resolve();
        });
      });
    });

    describe('dropColumn', () => {
      if (isSQLite(knex)) {
        describe('using wrapIdentifier and postProcessResponse', () => {
          const tableName = 'processor_drop_column_test';

          beforeEach(() => {
            knex.client.config.postProcessResponse = postProcessResponse;
            knex.client.config.wrapIdentifier = wrapIdentifier;

            return knex.schema
              .createTable(tableName, (tbl) => {
                tbl.integer('other_field');
                tbl.integer('field_foo');
              })
              .then(() => {
                // Data is necessary to "force" the sqlite3 dialect to actually
                // attempt to copy data to the temp table, triggering errors
                // if columns were not correctly copied/created/dropped.
                return knex
                  .insert({
                    field_foo: 1,
                    other_field: 1,
                  })
                  .into(tableName);
              });
          });

          afterEach(() => {
            knex.client.config.postProcessResponse = null;
            knex.client.config.wrapIdentifier = null;

            return knex.schema.dropTable(tableName);
          });

          for (const columnName of ['field_foo', 'FIELD_FOO']) {
            it(`drops the column when spelled '${columnName}'`, () =>
              knex.schema
                .table(tableName, (tbl) => tbl.dropColumn(columnName))
                .then(() => knex.schema.hasColumn(tableName, 'field_foo'))
                .then((exists) => {
                  expect(exists).to.equal(false);
                }));
          }
        });

        context('when table is created using raw create table', () => {
          beforeEach(async () => {
            await knex.schema.raw(`create table TEST(
              "i0" integer,
              'i1' integer,
              [i2] integer,
              \`i3\` integer,
              i4 integer,
              I5 integer,
              unique(i4, i5),
              constraint i0 primary key([i3], "i4"),
              unique([i2]),
              foreign key (i1) references bar ("i3")
            )`);
          });

          afterEach(() => knex.schema.dropTable('TEST'));

          const getCreateTableExpr = async () =>
            (
              await knex.schema.raw(
                'select name, sql from sqlite_master where type = "table" and name = "TEST"'
              )
            )[0].sql;

          const dropCol = (colName) =>
            knex.schema.alterTable('TEST', (tbl) => tbl.dropColumn(colName));

          const hasCol = (colName) => knex.schema.hasColumn('TEST', colName);

          it('drops the column', async () => {
            await dropCol('i0');
            expect(await hasCol('i0')).to.equal(false);
            // Constraint i0 should be unaffected:
            expect(await getCreateTableExpr()).to.equal(
              'CREATE TABLE "TEST"(\'i1\' integer, [i2] integer, `i3` integer, i4 ' +
                'integer, I5 integer, unique(i4, i5), constraint i0 primary ' +
                'key([i3], "i4"), unique([i2]), foreign key (i1) references bar ' +
                '("i3") )'
            );
            await dropCol('i1');
            expect(await hasCol('i1')).to.equal(false);
            // Foreign key on i1 should also be dropped:
            expect(await getCreateTableExpr()).to.equal(
              'CREATE TABLE "TEST"([i2] integer, `i3` integer, i4 integer, I5 integer, ' +
                'unique(i4, i5), constraint i0 primary key([i3], "i4"), unique([i2]))'
            );
            await dropCol('i2');
            expect(await hasCol('i2')).to.equal(false);
            expect(await getCreateTableExpr()).to.equal(
              'CREATE TABLE "TEST"(`i3` integer, i4 integer, I5 integer, ' +
                'unique(i4, i5), constraint i0 primary key([i3], "i4"))'
            );
            await dropCol('i3');
            expect(await hasCol('i3')).to.equal(false);
            expect(await getCreateTableExpr()).to.equal(
              'CREATE TABLE "TEST"(i4 integer, I5 integer, unique(i4, i5))'
            );
            await dropCol('i4');
            expect(await hasCol('i4')).to.equal(false);
            expect(await getCreateTableExpr()).to.equal(
              'CREATE TABLE "TEST"(I5 integer)'
            );
            let lastColDeletionError;
            await knex.schema
              .alterTable('TEST', (tbl) => tbl.dropColumn('i5'))
              .catch((e) => {
                lastColDeletionError = e;
              });
            expect(lastColDeletionError.message).to.eql(
              'Unable to drop last column from table'
            );
          });
        });
      }
    });

    describe('withSchema', () => {
      describe('mssql only', () => {
        if (!knex || !knex.client || !/mssql/i.test(knex.client.dialect)) {
          return Promise.resolve(true);
        }

        const columnName = 'test';

        function checkTable(schema, tableName, expected) {
          return knex.schema
            .withSchema(schema)
            .hasTable(tableName)
            .then((exists) => expect(exists).to.equal(expected));
        }

        function createTable(schema, tableName) {
          return knex.schema
            .withSchema(schema)
            .createTable(tableName, (table) => {
              table.string(columnName);
            });
        }

        function checkColumn(schema, tableName) {
          return knex.schema
            .withSchema(schema)
            .hasColumn(tableName, columnName)
            .then((exists) => {
              return expect(exists).to.equal(true);
            });
        }

        function renameTable(schema, from, to) {
          return knex.schema.withSchema(schema).renameTable(from, to);
        }

        function createSchema(schema) {
          return knex.schema.raw('CREATE SCHEMA ' + schema);
        }

        const defaultSchemaName = 'public';
        const testSchemaName = 'test';

        before(() => createSchema(testSchemaName));

        after(() => knex.schema.raw('DROP SCHEMA ' + testSchemaName));

        it('should not find non-existent tables', () =>
          checkTable(testSchemaName, 'test', false).then(() =>
            checkTable(defaultSchemaName, 'test', false)
          ));

        it('should create and drop tables', () =>
          createTable(testSchemaName, 'test')
            .then(() => checkColumn(testSchemaName, 'test'))
            .then(() => checkTable(testSchemaName, 'test', true))
            .then(() => checkTable(defaultSchemaName, 'test', false))
            .then(() =>
              knex.schema.withSchema(testSchemaName).dropTableIfExists('test')
            )
            .then(() => checkTable(testSchemaName, 'test', false)));

        it('should rename tables', () =>
          createTable(testSchemaName, 'test')
            .then(() => renameTable(testSchemaName, 'test', 'test2'))
            .then(() => checkColumn(testSchemaName, 'test2'))
            .then(() => checkTable(defaultSchemaName, 'test2', false))
            .then(() => checkTable(testSchemaName, 'test', false))
            .then(() => checkTable(testSchemaName, 'test2', true))
            .then(() =>
              knex.schema.withSchema(testSchemaName).dropTableIfExists('test2')
            ));
      });
    });

    it('should warn attempting to create primary from nonexistent columns', () => {
      // Redshift only
      if (!isRedshift(knex)) {
        return Promise.resolve(true);
      }
      const tableName = 'no_test_column';
      const constraintName = 'testconstraintname';
      return knex.transaction((tr) =>
        tr.schema
          .dropTableIfExists(tableName)
          .then(() =>
            tr.schema.createTable(tableName, (t) => {
              t.string('test_zero').notNullable();
              t.string('test_one').notNullable();
            })
          )
          .then(() =>
            tr.schema.table(tableName, (u) => {
              u.primary(['test_one', 'test_two'], constraintName);
            })
          )
          .then(() => {
            throw new Error('should have failed');
          })
          .catch((err) => {
            expect(err.code).to.equal('42703');
            expect(err.message).to.equal(
              `alter table "${tableName}" add constraint "${constraintName}" primary key ("test_one", "test_two") - column "test_two" named in key does not exist`
            );
          })
          .then((res) => knex.schema.dropTableIfExists(tableName))
      );
    });

    //Unit tests checks SQL -- This will test running those queries, no hard assertions here.
    it('#1430 - .primary() & .dropPrimary() same for all dialects', () => {
      if (isSQLite(knex)) {
        return Promise.resolve();
      }
      const constraintName = 'testconstraintname';
      const tableName = 'primarytest';
      return knex.transaction((tr) =>
        tr.schema
          .dropTableIfExists(tableName)
          .then(() =>
            tr.schema.createTable(tableName, (table) => {
              table.string('test').primary(constraintName);
              table.string('test2').notNullable();
            })
          )
          .then((res) =>
            tr.schema.table(tableName, (table) => {
              table.dropPrimary(constraintName);
            })
          )
          .then(() =>
            tr.schema.table(tableName, (table) => {
              table.primary(['test', 'test2'], constraintName);
            })
          )
      );
    });

    describe('invalid field', () => {
      describe('sqlite3 only', () => {
        const tableName = 'invalid_field_test_sqlite3';
        const fieldName = 'field_foo';
        if (!isSQLite(knex)) {
          return Promise.resolve();
        }

        before(() =>
          knex.schema.createTable(tableName, (tbl) => {
            tbl.integer(fieldName);
          })
        );

        after(() => knex.schema.dropTable(tableName));

        it('should return empty resultset when referencing an existent column', () =>
          knex(tableName)
            .select()
            .where(fieldName, 'something')
            .then((rows) => {
              expect(rows.length).to.equal(0);
            }));

        it('should throw when referencing a non-existent column', () =>
          knex(tableName)
            .select()
            .where(fieldName + 'foo', 'something')
            .then(() => {
              throw new Error('should have failed');
            })
            .catch((err) => {
              expect(err.code).to.equal('SQLITE_ERROR');
            }));
      });
    });
    it('supports named primary keys', async () => {
      const constraintName = 'pk-test';
      const tableName = 'namedpk';
      const expectedRes = [
        {
          type: 'table',
          name: tableName,
          tbl_name: tableName,
          sql:
            'CREATE TABLE `' +
            tableName +
            '` (`test` varchar(255), `test2` varchar(255), constraint `' +
            constraintName +
            '` primary key (`test`))',
        },
      ];

      await knex.transaction((tr) =>
        tr.schema
          .dropTableIfExists(tableName)
          .then(() =>
            tr.schema.createTable(tableName, (table) => {
              table.string('test').primary(constraintName);
              table.string('test2');
            })
          )
          .then(() => {
            if (/sqlite/i.test(knex.client.dialect)) {
              //For SQLite inspect metadata to make sure the constraint exists
              return tr
                .select('type', 'name', 'tbl_name', 'sql')
                .from('sqlite_master')
                .where({
                  type: 'table',
                  name: tableName,
                })
                .then((value) => {
                  expect(value).to.deep.have.same.members(
                    expectedRes,
                    'Constraint "' + constraintName + '" not correctly created.'
                  );
                  return Promise.resolve();
                });
            } else {
              return tr.schema.table(tableName, (table) => {
                // For everything else just drop the constraint by name to check existence
                table.dropPrimary(constraintName);
              });
            }
          })
          .then(() => tr.schema.dropTableIfExists(tableName))
          .then(() =>
            tr.schema.createTable(tableName, (table) => {
              table.string('test');
              table.string('test2');
              table.primary('test', constraintName);
            })
          )
          .then(() => {
            if (/sqlite/i.test(knex.client.dialect)) {
              //For SQLite inspect metadata to make sure the constraint exists
              return tr
                .select('type', 'name', 'tbl_name', 'sql')
                .from('sqlite_master')
                .where({
                  type: 'table',
                  name: tableName,
                })
                .then((value) => {
                  expect(value).to.deep.have.same.members(
                    expectedRes,
                    'Constraint "' + constraintName + '" not correctly created.'
                  );
                  return Promise.resolve();
                });
            } else {
              return tr.schema.table(tableName, (table) => {
                // For everything else just drop the constraint by name to check existence
                table.dropPrimary(constraintName);
              });
            }
          })
          .then(() => tr.schema.dropTableIfExists(tableName))
          .then(() =>
            tr.schema.createTable(tableName, (table) => {
              table.string('test');
              table.string('test2');
              table.primary(['test', 'test2'], constraintName);
            })
          )
          .then(() => {
            if (/sqlite/i.test(knex.client.dialect)) {
              //For SQLite inspect metadata to make sure the constraint exists
              const expectedRes = [
                {
                  type: 'table',
                  name: tableName,
                  tbl_name: tableName,
                  sql:
                    'CREATE TABLE `' +
                    tableName +
                    '` (`test` varchar(255), `test2` varchar(255), constraint `' +
                    constraintName +
                    '` primary key (`test`, `test2`))',
                },
              ];
              return tr
                .select('type', 'name', 'tbl_name', 'sql')
                .from('sqlite_master')
                .where({
                  type: 'table',
                  name: tableName,
                })
                .then((value) => {
                  expect(value).to.deep.have.same.members(
                    expectedRes,
                    'Constraint "' + constraintName + '" not correctly created.'
                  );
                  return Promise.resolve();
                });
            } else {
              return tr.schema.table(tableName, (table) => {
                // For everything else just drop the constraint by name to check existence
                table.dropPrimary(constraintName);
              });
            }
          })
          .then(() => tr.schema.dropTableIfExists(tableName))
      );
    });

    it('supports named unique keys', () => {
      const singleUniqueName = 'uk-single';
      const multiUniqueName = 'uk-multi';
      const tableName = 'nameduk';
      return knex.transaction((tr) =>
        tr.schema
          .dropTableIfExists(tableName)
          .then(() =>
            tr.schema.createTable(tableName, (table) => {
              table.string('test').unique(singleUniqueName);
            })
          )
          .then(() => {
            if (/sqlite/i.test(knex.client.dialect)) {
              //For SQLite inspect metadata to make sure the constraint exists
              const expectedRes = [
                {
                  type: 'index',
                  name: singleUniqueName,
                  tbl_name: tableName,
                  sql:
                    'CREATE UNIQUE INDEX `' +
                    singleUniqueName +
                    '` on `' +
                    tableName +
                    '` (`test`)',
                },
              ];
              return tr
                .select('type', 'name', 'tbl_name', 'sql')
                .from('sqlite_master')
                .where({
                  type: 'index',
                  tbl_name: tableName,
                  name: singleUniqueName,
                })
                .then((value) => {
                  expect(value).to.deep.have.same.members(
                    expectedRes,
                    'Constraint "' +
                      singleUniqueName +
                      '" not correctly created.'
                  );
                  return Promise.resolve();
                });
            } else {
              return tr.schema.table(tableName, (table) => {
                // For everything else just drop the constraint by name to check existence
                table.dropUnique('test', singleUniqueName);
              });
            }
          })
          .then(() => tr.schema.dropTableIfExists(tableName))
          .then(() =>
            tr.schema.createTable(tableName, (table) => {
              table.string('test');
              table.string('test2');
            })
          )
          .then(() =>
            tr.schema.table(tableName, (table) => {
              table.unique('test', singleUniqueName);
              table.unique(['test', 'test2'], multiUniqueName);
            })
          )
          .then(() => {
            if (/sqlite/i.test(knex.client.dialect)) {
              //For SQLite inspect metadata to make sure the constraint exists
              const expectedRes = [
                {
                  type: 'index',
                  name: singleUniqueName,
                  tbl_name: tableName,
                  sql:
                    'CREATE UNIQUE INDEX `' +
                    singleUniqueName +
                    '` on `' +
                    tableName +
                    '` (`test`)',
                },
                {
                  type: 'index',
                  name: multiUniqueName,
                  tbl_name: tableName,
                  sql:
                    'CREATE UNIQUE INDEX `' +
                    multiUniqueName +
                    '` on `' +
                    tableName +
                    '` (`test`, `test2`)',
                },
              ];
              return tr
                .select('type', 'name', 'tbl_name', 'sql')
                .from('sqlite_master')
                .where({
                  type: 'index',
                  tbl_name: tableName,
                })
                .then((value) => {
                  expect(value).to.deep.have.same.members(
                    expectedRes,
                    'Either "' +
                      singleUniqueName +
                      '" or "' +
                      multiUniqueName +
                      '" is missing.'
                  );
                  return Promise.resolve();
                });
            } else {
              return tr.schema.table(tableName, (table) => {
                // For everything else just drop the constraint by name to check existence
                table.dropUnique('test', singleUniqueName);
                table.dropUnique(['test', 'test2'], multiUniqueName);
              });
            }
          })
          .then(() => tr.schema.dropTableIfExists(tableName))
      );
    });

    it('supports named foreign keys', () => {
      const userTableName = 'nfk_user';
      const groupTableName = 'nfk_group';
      const joinTableName = 'nfk_user_group';
      const userConstraint = ['fk', joinTableName, userTableName].join('-');
      const groupConstraint = ['fk', joinTableName, groupTableName].join('-');
      return knex.transaction((tr) =>
        tr.schema
          .dropTableIfExists(joinTableName)
          .then(() => tr.schema.dropTableIfExists(userTableName))
          .then(() => tr.schema.dropTableIfExists(groupTableName))
          .then(() =>
            tr.schema.createTable(userTableName, (table) => {
              table.uuid('id').primary();
              table.string('name').unique();
            })
          )
          .then(() =>
            tr.schema.createTable(groupTableName, (table) => {
              table.uuid('id').primary();
              table.string('name').unique();
            })
          )
          .then(() =>
            tr.schema.createTable(joinTableName, (table) => {
              table
                .uuid('user')
                .references('id')
                .inTable(userTableName)
                .withKeyName(['fk', joinTableName, userTableName].join('-'));
              table.uuid('group');
              table.primary(['user', 'group']);
              table
                .foreign(
                  'group',
                  ['fk', joinTableName, groupTableName].join('-')
                )
                .references('id')
                .inTable(groupTableName);
            })
          )
          .then(() => {
            if (/sqlite/i.test(knex.client.dialect)) {
              const expectedRes = [
                {
                  type: 'table',
                  name: joinTableName,
                  tbl_name: joinTableName,
                  sql:
                    'CREATE TABLE `' +
                    joinTableName +
                    '` (`user` char(36), `group` char(36), constraint `' +
                    userConstraint +
                    '` foreign key(`user`) references `' +
                    userTableName +
                    '`(`id`), constraint `' +
                    groupConstraint +
                    '` foreign key(`group`) references `' +
                    groupTableName +
                    '`(`id`), primary key (`user`, `group`))',
                },
              ];
              tr.select('type', 'name', 'tbl_name', 'sql')
                .from('sqlite_master')
                .where({
                  type: 'table',
                  name: joinTableName,
                })
                .then((value) => {
                  expect(value).to.deep.have.same.members(
                    expectedRes,
                    'Named foreign key not correctly created.'
                  );
                  return Promise.resolve();
                });
            } else {
              return tr.schema.table(joinTableName, (table) => {
                table.dropForeign('user', userConstraint);
                table.dropForeign('group', groupConstraint);
              });
            }
          })
          .then(() =>
            tr.schema
              .dropTableIfExists(userTableName)
              .then(() => tr.schema.dropTableIfExists(groupTableName))
              .then(() => tr.schema.dropTableIfExists(joinTableName))
          )
      );
    });
  });
};
