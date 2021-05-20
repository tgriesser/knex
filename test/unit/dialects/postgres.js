const knex = require('../../../knex');
const expect = require('chai').expect;
const sinon = require('sinon');
const pgDialect = require('../../../lib/dialects/postgres/index.js');
const pg = require('pg');
const _ = require('lodash');
const { isFunction } = require('../../../lib/util/is');

describe('Postgres Unit Tests', function () {
  let checkVersionStub, querySpy;
  before(() => {
    const fakeConnection = {
      query: (...args) => {
        const cb = args.find((arg) => {
          return isFunction(arg);
        });
        cb();
      },
      on: _.noop,
    };
    querySpy = sinon.spy(fakeConnection, 'query');

    checkVersionStub = sinon
      .stub(pgDialect.prototype, 'checkVersion')
      .callsFake(function () {
        return Promise.resolve('9.6');
      });

    sinon.stub(pg.Client.prototype, 'connect').callsFake(function (cb) {
      cb(null, fakeConnection);
    });
  });
  afterEach(() => {
    querySpy.resetHistory();
  });
  after(() => {
    sinon.restore();
  });

  it('does not resolve client version if specified explicitly', (done) => {
    const knexInstance = knex({
      client: 'postgresql',
      version: '10.5',
      connection: {
        pool: {},
      },
    });
    knexInstance.raw('select 1 as 1').then((result) => {
      expect(checkVersionStub.notCalled).to.equal(true);
      knexInstance.destroy();
      done();
    });
  });

  it('escape statements correctly', async () => {
    const knexInstance = knex({
      client: 'postgresql',
      version: '10.5',
      connection: {
        pool: {},
      },
    });
    const sql = knexInstance('projects')
      .where('id = 1 UNION SELECT 1, version();', 1)
      .toSQL();
    expect(sql.sql).to.equal(
      'select * from "projects" where "id = 1 UNION SELECT 1, version();" = ?'
    );

    const sql2 = knexInstance('projects')
      .where('id = 1" UNION SELECT 1, version();', 1)
      .toSQL();
    expect(sql2.sql).to.equal(
      'select * from "projects" where "id = 1"" UNION SELECT 1, version();" = ?'
    );
  });

  it('resolve client version if not specified explicitly', (done) => {
    const knexInstance = knex({
      client: 'postgresql',
      connection: {
        pool: {},
      },
    });
    knexInstance.raw('select 1 as 1').then((result) => {
      expect(checkVersionStub.calledOnce).to.equal(true);
      knexInstance.destroy();
      done();
    });
  });

  it('Validates searchPath as Array/String', function () {
    const knexInstance = knex({
      client: 'pg',
    });

    expect(function () {
      knexInstance.client.setSchemaSearchPath(null, {});
    }).to.throw(TypeError);

    expect(function () {
      knexInstance.client.setSchemaSearchPath(null, 4);
    }).to.throw(TypeError);

    const fakeQueryFn = function (expectedSearchPath) {
      return {
        query: function (sql, callback) {
          try {
            expect(sql).to.equal('set search_path to ' + expectedSearchPath);
            callback(null);
          } catch (error) {
            callback(error);
          }
        },
      };
    };

    return knexInstance.client
      .setSchemaSearchPath(fakeQueryFn('"public,knex"'), 'public,knex')
      .then(function () {
        return knexInstance.client.setSchemaSearchPath(
          fakeQueryFn('"public","knex"'),
          ['public', 'knex']
        );
      })
      .then(function () {
        return knexInstance.client.setSchemaSearchPath(
          fakeQueryFn('"public"'),
          'public'
        );
      });
  });
  it('Uses documented query config as param when providing bindings', (done) => {
    const knexInstance = knex({
      client: 'postgresql',
      connection: {},
    });
    knexInstance.raw('select 1 as ?', ['foo']).then((result) => {
      sinon.assert.calledOnce(querySpy);
      sinon.assert.calledWithExactly(
        querySpy,
        {
          text: 'select 1 as $1',
          values: ['foo'],
        },
        sinon.match.func
      );
      knexInstance.destroy();
      done();
    });
  });
  it('Resolves Ref in columnInfo query', () => {
    const knexPg = knex({
      client: 'pg',
    });

    const sql = knexPg(knexPg.ref('test').withSchema('foo'))
      .columnInfo()
      .toSQL();
    expect(sql.sql).to.equal(
      'select * from information_schema.columns where table_name = ? and table_catalog = ? and table_schema = ?'
    );
    expect(sql.bindings).to.deep.equal(['test', undefined, 'foo']);
  });
});
