// PostgreSQL
// -------
const extend = require('lodash/extend');
const map = require('lodash/map');
const { promisify } = require('util');
const Client = require('../../client');

const Transaction = require('./execution/pg-transaction');
const QueryCompiler = require('./query/pg-querycompiler');
const ColumnCompiler = require('./schema/pg-columncompiler');
const TableCompiler = require('./schema/pg-tablecompiler');
const SchemaCompiler = require('./schema/pg-compiler');
const { makeEscape } = require('../../util/string');
const { isString } = require('../../util/is');

class Client_PG extends Client {
  constructor(config) {
    super(config);
    if (config.returning) {
      this.defaultReturning = config.returning;
    }

    if (config.searchPath) {
      this.searchPath = config.searchPath;
    }
  }
  transaction() {
    return new Transaction(this, ...arguments);
  }

  queryCompiler(builder, formatter) {
    return new QueryCompiler(this, builder, formatter);
  }

  columnCompiler() {
    return new ColumnCompiler(this, ...arguments);
  }

  schemaCompiler() {
    return new SchemaCompiler(this, ...arguments);
  }

  tableCompiler() {
    return new TableCompiler(this, ...arguments);
  }

  _driver() {
    return require('pg');
  }

  wrapIdentifierImpl(value) {
    if (value === '*') return value;

    let arrayAccessor = '';
    const arrayAccessorMatch = value.match(/(.*?)(\[[0-9]+\])/);

    if (arrayAccessorMatch) {
      value = arrayAccessorMatch[1];
      arrayAccessor = arrayAccessorMatch[2];
    }

    return `"${value.replace(/"/g, '""')}"${arrayAccessor}`;
  }

  // Get a raw connection, called by the `pool` whenever a new
  // connection needs to be added to the pool.
  acquireRawConnection() {
    const client = this;
    return new Promise(function (resolver, rejecter) {
      const connection = new client.driver.Client(client.connectionSettings);
      connection.connect(function (err, connection) {
        if (err) {
          return rejecter(err);
        }
        connection.on('error', (err) => {
          connection.__knex__disposed = err;
        });
        connection.on('end', (err) => {
          connection.__knex__disposed = err || 'Connection ended unexpectedly';
        });
        if (!client.version) {
          return client.checkVersion(connection).then(function (version) {
            client.version = version;
            resolver(connection);
          });
        }
        resolver(connection);
      });
    }).then(function setSearchPath(connection) {
      client.setSchemaSearchPath(connection);
      return connection;
    });
  }

  // Used to explicitly close a connection, called internally by the pool
  // when a connection times out or the pool is shutdown.
  async destroyRawConnection(connection) {
    const end = promisify((cb) => connection.end(cb));
    return end();
  }

  // In PostgreSQL, we need to do a version check to do some feature
  // checking on the database.
  checkVersion(connection) {
    return new Promise(function (resolver, rejecter) {
      connection.query('select version();', function (err, resp) {
        if (err) return rejecter(err);
        resolver(/^PostgreSQL (.*?)( |$)/.exec(resp.rows[0].version)[1]);
      });
    });
  }

  // Position the bindings for the query. The escape sequence for question mark
  // is \? (e.g. knex.raw("\\?") since javascript requires '\' to be escaped too...)
  positionBindings(sql) {
    let questionCount = 0;
    return sql.replace(/(\\*)(\?)/g, function (match, escapes) {
      if (escapes.length % 2) {
        return '?';
      } else {
        questionCount++;
        return `$${questionCount}`;
      }
    });
  }

  setSchemaSearchPath(connection, searchPath) {
    let path = searchPath || this.searchPath;

    if (!path) return Promise.resolve(true);

    if (!Array.isArray(path) && !isString(path)) {
      throw new TypeError(
        `knex: Expected searchPath to be Array/String, got: ${typeof path}`
      );
    }

    if (isString(path)) {
      if (path.includes(',')) {
        const parts = path.split(',');
        const arraySyntax = `[${parts
          .map((searchPath) => `'${searchPath}'`)
          .join(', ')}]`;
        this.logger.warn(
          `Detected comma in searchPath "${path}".` +
            `If you are trying to specify multiple schemas, use Array syntax: ${arraySyntax}`
        );
      }
      path = [path];
    }

    path = path.map((schemaName) => `"${schemaName}"`).join(',');

    return new Promise(function (resolver, rejecter) {
      connection.query(`set search_path to ${path}`, function (err) {
        if (err) return rejecter(err);
        resolver(true);
      });
    });
  }

  _stream(connection, obj, stream, options) {
    if (!obj.sql) throw new Error('The query is empty');

    const PGQueryStream = process.browser
      ? undefined
      : require('pg-query-stream');
    const sql = obj.sql;

    return new Promise(function (resolver, rejecter) {
      const queryStream = connection.query(
        new PGQueryStream(sql, obj.bindings, options)
      );

      queryStream.on('error', function (error) {
        rejecter(error);
        stream.emit('error', error);
      });

      // 'end' IS propagated by .pipe, by default
      stream.on('end', resolver);
      queryStream.pipe(stream);
    });
  }

  // Runs the query on the specified connection, providing the bindings
  // and any other necessary prep work.
  _query(connection, obj) {
    if (!obj.sql) throw new Error('The query is empty');

    let queryConfig = {
      text: obj.sql,
      values: obj.bindings || [],
    };

    if (obj.options) {
      queryConfig = extend(queryConfig, obj.options);
    }

    return new Promise(function (resolver, rejecter) {
      connection.query(queryConfig, function (err, response) {
        if (err) return rejecter(err);
        obj.response = response;
        resolver(obj);
      });
    });
  }

  // Ensures the response is returned in the same format as other clients.
  processResponse(obj, runner) {
    const resp = obj.response;
    if (obj.output) return obj.output.call(runner, resp);
    if (obj.method === 'raw') return resp;
    const { returning } = obj;
    if (resp.command === 'SELECT') {
      if (obj.method === 'first') return resp.rows[0];
      if (obj.method === 'pluck') return map(resp.rows, obj.pluck);
      return resp.rows;
    }
    if (returning) {
      const returns = [];
      for (let i = 0, l = resp.rows.length; i < l; i++) {
        const row = resp.rows[i];
        returns[i] = row;
      }
      return returns;
    }
    if (resp.command === 'UPDATE' || resp.command === 'DELETE') {
      return resp.rowCount;
    }
    return resp;
  }

  async cancelQuery(connectionToKill) {
    const conn = await this.acquireRawConnection();

    try {
      return await this._wrappedCancelQueryCall(conn, connectionToKill);
    } finally {
      await this.destroyRawConnection(conn).catch((err) => {
        this.logger.warn(`Connection Error: ${err}`);
      });
    }
  }
  _wrappedCancelQueryCall(conn, connectionToKill) {
    return this._query(conn, {
      sql: 'SELECT pg_cancel_backend($1);',
      bindings: [connectionToKill.processID],
      options: {},
    });
  }
}

Object.assign(Client_PG.prototype, {
  dialect: 'postgresql',

  driverName: 'pg',
  canCancelQuery: true,

  _escapeBinding: makeEscape({
    escapeArray(val, esc) {
      return esc(arrayString(val, esc));
    },
    escapeString(str) {
      let hasBackslash = false;
      let escaped = "'";
      for (let i = 0; i < str.length; i++) {
        const c = str[i];
        if (c === "'") {
          escaped += c + c;
        } else if (c === '\\') {
          escaped += c + c;
          hasBackslash = true;
        } else {
          escaped += c;
        }
      }
      escaped += "'";
      if (hasBackslash === true) {
        escaped = 'E' + escaped;
      }
      return escaped;
    },
    escapeObject(val, prepareValue, timezone, seen = []) {
      if (val && typeof val.toPostgres === 'function') {
        seen = seen || [];
        if (seen.indexOf(val) !== -1) {
          throw new Error(
            `circular reference detected while preparing "${val}" for query`
          );
        }
        seen.push(val);
        return prepareValue(val.toPostgres(prepareValue), seen);
      }
      return JSON.stringify(val);
    },
  }),
});

function arrayString(arr, esc) {
  let result = '{';
  for (let i = 0; i < arr.length; i++) {
    if (i > 0) result += ',';
    const val = arr[i];
    if (val === null || typeof val === 'undefined') {
      result += 'NULL';
    } else if (Array.isArray(val)) {
      result += arrayString(val, esc);
    } else if (typeof val === 'number') {
      result += val;
    } else {
      result += JSON.stringify(typeof val === 'string' ? val : esc(val));
    }
  }
  return result + '}';
}

module.exports = Client_PG;
