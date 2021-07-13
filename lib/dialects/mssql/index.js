// MSSQL Client
// -------
const flatten = require('lodash/flatten');
const map = require('lodash/map');
const values = require('lodash/values');
const isNil = require('lodash/isNil');

const Client = require('../../client');
const MSSQL_Formatter = require('./mssql-formatter');
const Transaction = require('./transaction');
const QueryCompiler = require('./query/mssql-querycompiler');
const SchemaCompiler = require('./schema/mssql-compiler');
const TableCompiler = require('./schema/mssql-tablecompiler');
const ColumnCompiler = require('./schema/mssql-columncompiler');
const QueryBuilder = require('../../query/querybuilder');

const debug = require('debug')('knex:mssql');

const SQL_INT4 = { MIN: -2147483648, MAX: 2147483647 };
const SQL_BIGINT_SAFE = { MIN: -9007199254740991, MAX: 9007199254740991 };

// Always initialize with the "QueryBuilder" and "QueryCompiler" objects, which
// extend the base 'lib/query/builder' and 'lib/query/compiler', respectively.
class Client_MSSQL extends Client {
  constructor(config = {}) {
    super(config);
  }

  /**
   * @param {import('knex').Config} options
   */
  _generateConnection() {
    const settings = this.connectionSettings;
    settings.options = settings.options || {};

    /** @type {import('tedious').ConnectionConfig} */
    const cfg = {
      authentication: {
        type: settings.type || 'default',
        options: {
          userName: settings.userName || settings.user,
          password: settings.password,
          domain: settings.domain,
          token: settings.token,
          clientId: settings.clientId,
          clientSecret: settings.clientSecret,
          tenantId: settings.tenantId,
          msiEndpoint: settings.msiEndpoint,
        },
      },
      server: settings.server || settings.host,
      options: {
        database: settings.database,
        encrypt: settings.encrypt || false,
        port: settings.port || 1433,
        connectTimeout: settings.connectionTimeout || settings.timeout || 15000,
        requestTimeout: !isNil(settings.requestTimeout)
          ? settings.requestTimeout
          : 15000,
        rowCollectionOnDone: false,
        rowCollectionOnRequestCompletion: false,
        useColumnNames: false,
        tdsVersion: settings.options.tdsVersion || '7_4',
        appName: settings.options.appName || 'knex',
        trustServerCertificate: false,
        ...settings.options,
      },
    };

    // tedious always connect via tcp when port is specified
    if (cfg.options.instanceName) delete cfg.options.port;

    if (isNaN(cfg.options.requestTimeout)) cfg.options.requestTimeout = 15000;
    if (cfg.options.requestTimeout === Infinity) cfg.options.requestTimeout = 0;
    if (cfg.options.requestTimeout < 0) cfg.options.requestTimeout = 0;

    if (settings.debug) {
      cfg.options.debug = {
        packet: true,
        token: true,
        data: true,
        payload: true,
      };
    }

    return cfg;
  }

  _driver() {
    const tds = require('tedious');

    return tds;
  }

  formatter() {
    return new MSSQL_Formatter(this, ...arguments);
  }

  transaction() {
    return new Transaction(this, ...arguments);
  }

  queryCompiler() {
    return new QueryCompiler(this, ...arguments);
  }

  schemaCompiler() {
    return new SchemaCompiler(this, ...arguments);
  }

  tableCompiler() {
    return new TableCompiler(this, ...arguments);
  }

  queryBuilder() {
    const b = new QueryBuilder(this);
    return b;
  }

  columnCompiler() {
    return new ColumnCompiler(this, ...arguments);
  }

  wrapIdentifierImpl(value) {
    if (value === '*') {
      return '*';
    }

    return `[${value.replace(/[[\]]+/g, '')}]`;
  }

  // Get a raw connection, called by the `pool` whenever a new
  // connection needs to be added to the pool.
  acquireRawConnection() {
    return new Promise((resolver, rejecter) => {
      debug('connection::connection new connection requested');
      const Driver = this._driver();
      const settings = Object.assign({}, this._generateConnection());

      const connection = new Driver.Connection(settings);

      connection.connect((err) => {
        if (err) {
          debug('connection::connect error: %s', err.message);
          return rejecter(err);
        }

        debug('connection::connect connected to server');

        connection.connected = true;
        connection.on('error', (e) => {
          debug('connection::error message=%s', e.message);
          connection.__knex__disposed = e;
          connection.connected = false;
        });

        connection.once('end', () => {
          connection.connected = false;
          connection.__knex__disposed = 'Connection to server was terminated.';
          debug('connection::end connection ended.');
        });

        return resolver(connection);
      });
    });
  }

  validateConnection(connection) {
    return connection && connection.connected;
  }

  // Used to explicitly close a connection, called internally by the pool
  // when a connection times out or the pool is shutdown.
  destroyRawConnection(connection) {
    debug('connection::destroy');

    return new Promise((resolve) => {
      connection.once('end', () => {
        resolve();
      });

      connection.close();
    });
  }

  // Position the bindings for the query.
  positionBindings(sql) {
    let questionCount = -1;
    return sql.replace(/\\?\?/g, (match) => {
      if (match === '\\?') {
        return '?';
      }

      questionCount += 1;
      return `@p${questionCount}`;
    });
  }

  _chomp(connection) {
    if (connection.state.name === 'LoggedIn') {
      const nextRequest = this.requestQueue.pop();
      if (nextRequest) {
        debug(
          'connection::query executing query, %d more in queue',
          this.requestQueue.length
        );

        connection.execSql(nextRequest);
      }
    }
  }

  _enqueueRequest(request, connection) {
    this.requestQueue.push(request);
    this._chomp(connection);
  }

  _makeRequest(query, callback) {
    const Driver = this._driver();
    const sql = typeof query === 'string' ? query : query.sql;
    let rowCount = 0;

    if (!sql) throw new Error('The query is empty');

    debug('request::request sql=%s', sql);

    const request = new Driver.Request(sql, (err, remoteRowCount) => {
      if (err) {
        debug('request::error message=%s', err.message);
        return callback(err);
      }

      rowCount = remoteRowCount;
      debug('request::callback rowCount=%d', rowCount);
    });

    request.on('prepared', () => {
      debug('request %s::request prepared', this.id);
    });

    request.on('done', (rowCount, more) => {
      debug('request::done rowCount=%d more=%s', rowCount, more);
    });

    request.on('doneProc', (rowCount, more) => {
      debug(
        'request::doneProc id=%s rowCount=%d more=%s',
        request.id,
        rowCount,
        more
      );
    });

    request.on('doneInProc', (rowCount, more) => {
      debug(
        'request::doneInProc id=%s rowCount=%d more=%s',
        request.id,
        rowCount,
        more
      );
    });

    request.once('requestCompleted', () => {
      debug('request::completed id=%s', request.id);
      return callback(null, rowCount);
    });

    request.on('error', (err) => {
      debug('request::error id=%s message=%s', request.id, err.message);
      return callback(err);
    });

    return request;
  }

  // Grab a connection, run the query via the MSSQL streaming interface,
  // and pass that through to the stream we've sent back to the client.
  _stream(connection, query, /** @type {NodeJS.ReadWriteStream} */ stream) {
    return new Promise((resolve, reject) => {
      const request = this._makeRequest(query, (err) => {
        if (err) {
          stream.emit('error', err);
          return reject(err);
        }

        resolve();
      });

      request.on('row', (row) => {
        stream.write(
          row.reduce(
            (prev, curr) => ({
              ...prev,
              [curr.metadata.colName]: curr.value,
            }),
            {}
          )
        );
      });
      request.on('error', (err) => {
        stream.emit('error', err);
        reject(err);
      });
      request.once('requestCompleted', () => {
        stream.end();
        resolve();
      });

      this._assignBindings(request, query.bindings);
      this._enqueueRequest(request, connection);
    });
  }

  _assignBindings(request, bindings) {
    if (Array.isArray(bindings)) {
      for (let i = 0; i < bindings.length; i++) {
        const binding = bindings[i];
        this._setReqInput(request, i, binding);
      }
    }
  }

  _scaleForBinding(binding) {
    if (binding % 1 === 0) {
      throw new Error(`The binding value ${binding} must be a decimal number.`);
    }

    return { scale: 10 };
  }

  _typeForBinding(binding) {
    const Driver = this._driver();

    switch (typeof binding) {
      case 'string':
        return Driver.TYPES.NVarChar;
      case 'boolean':
        return Driver.TYPES.Bit;
      case 'number': {
        if (binding % 1 !== 0) {
          return Driver.TYPES.Float;
        }

        if (binding < SQL_INT4.MIN || binding > SQL_INT4.MAX) {
          if (binding < SQL_BIGINT_SAFE.MIN || binding > SQL_BIGINT_SAFE.MAX) {
            throw new Error(
              `Bigint must be safe integer or must be passed as string, saw ${binding}`
            );
          }

          return Driver.TYPES.BigInt;
        }

        return Driver.TYPES.Int;
      }
      default: {
        // if (binding === null || typeof binding === 'undefined') {
        //   return tedious.TYPES.Null;
        // }

        if (binding instanceof Date) {
          return Driver.TYPES.DateTime;
        }

        if (binding instanceof Buffer) {
          return Driver.TYPES.VarBinary;
        }

        return Driver.TYPES.NVarChar;
      }
    }
  }

  // Runs the query on the specified connection, providing the bindings
  // and any other necessary prep work.
  _query(connection, query) {
    return new Promise((resolve, reject) => {
      const rows = [];
      const request = this._makeRequest(query, (err, count) => {
        if (err) {
          return reject(err);
        }

        query.response = rows;

        process.nextTick(() => this._chomp(connection));

        resolve(query);
      });

      request.on('row', (row) => {
        debug('request::row');
        rows.push(row);
      });

      this._assignBindings(request, query.bindings);
      this._enqueueRequest(request, connection);
    });
  }

  // sets a request input parameter. Detects bigints and decimals and sets type appropriately.
  _setReqInput(req, i, binding) {
    const tediousType = this._typeForBinding(binding);
    const bindingName = 'p'.concat(i);
    let options;

    if (typeof binding === 'number' && binding % 1 !== 0) {
      options = this._scaleForBinding(binding);
    }

    debug(
      'request::binding pos=%d type=%s value=%s',
      i,
      tediousType.name,
      binding
    );

    if (Buffer.isBuffer(binding)) {
      options = {
        length: 'max',
      };
    }

    req.addParameter(bindingName, tediousType, binding, options);
  }

  // Process the response as returned from the query.
  processResponse(query, runner) {
    if (query == null) return;
    let { response } = query;
    const { method } = query;

    if (query.output) {
      return query.output.call(runner, response);
    }

    response = response.map((row) =>
      row.reduce((columns, r) => {
        const colName = r.metadata.colName;

        if (columns[colName]) {
          if (!Array.isArray(columns[colName])) {
            columns[colName] = [columns[colName]];
          }

          columns[colName].push(r.value);
        } else {
          columns[colName] = r.value;
        }

        return columns;
      }, {})
    );

    if (query.output) return query.output.call(runner, response);
    switch (method) {
      case 'select':
        return response;
      case 'first':
        return response[0];
      case 'pluck':
        return map(response, query.pluck);
      case 'insert':
      case 'del':
      case 'update':
      case 'counter':
        if (query.returning) {
          if (query.returning === '@@rowcount') {
            return response[0][''];
          }

          if (
            (Array.isArray(query.returning) && query.returning.length > 1) ||
            query.returning[0] === '*'
          ) {
            return response;
          }
          // return an array with values if only one returning value was specified
          return flatten(map(response, values));
        }
        return response;
      default:
        return response;
    }
  }
}

Object.assign(Client_MSSQL.prototype, {
  requestQueue: [],

  dialect: 'mssql',

  driverName: 'mssql',
});

module.exports = Client_MSSQL;
