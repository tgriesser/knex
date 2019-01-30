/*global describe*/

'use strict';

require('source-map-support').install();

global.sinon = require('sinon');

const chai = (global.chai = require('chai'));

chai.use(require('sinon-chai'));
chai.should();

const Promise = (global.testPromise = require('bluebird'));
global.expect = chai.expect;
global.d = new Date();

Promise.longStackTraces();

describe('Query Building Tests', function() {
  this.timeout(process.env.KNEX_TEST_TIMEOUT || 5000);

  require('./unit/query/builder');
  require('./unit/schema/mysql')('mysql');
  require('./unit/schema/mysql')('mysql2');
  require('./unit/schema/postgres');
  require('./unit/schema/redshift');
  require('./unit/schema/sqlite3');
  require('./unit/schema/oracle');
  require('./unit/schema/mssql');
  require('./unit/schema/oracledb');
  require('./unit/migrate/migration-list-resolver');
  require('./unit/seed/seeder');
  require('./test/unit/util/mysql-charset-handler');
});

describe('Integration Tests', function() {
  this.timeout(process.env.KNEX_TEST_TIMEOUT || 5000);
  require('./integration');
});

const config = require('./knexfile');
if (config.oracledb) {
  describe('Oracledb driver tests', function() {
    this.timeout(process.env.KNEX_TEST_TIMEOUT || 5000);
    require('./unit/dialects/oracledb');
  });
}

if (config.postgres) {
  require('./unit/dialects/postgres');
}

if (config.sqlite3) {
  describe('Sqlite driver tests', function() {
    this.timeout(process.env.KNEX_TEST_TIMEOUT || 5000);
    require('./unit/dialects/sqlite3');
  });
}
