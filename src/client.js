
var _              = require('lodash')
var Promise        = require('./promise')
var helpers        = require('./helpers')

var Raw            = require('./raw')
var Runner         = require('./runner')
var Formatter      = require('./formatter')
var Transaction    = require('./transaction')

var QueryBuilder   = require('./query/builder')
var QueryCompiler  = require('./query/compiler')

var SchemaBuilder  = require('./schema/builder')
var SchemaCompiler = require('./schema/compiler')
var TableBuilder   = require('./schema/tablebuilder')
var TableCompiler  = require('./schema/tablecompiler')
var ColumnBuilder  = require('./schema/columnbuilder')
var ColumnCompiler = require('./schema/columncompiler')

var Pool2          = require('pool2')
var inherits       = require('inherits')
var EventEmitter   = require('events').EventEmitter
var SqlString      = require('./query/string')

var assign         = require('lodash/object/assign')
var uniqueId       = require('lodash/utility/uniqueId')
var cloneDeep      = require('lodash/lang/cloneDeep')
var debug          = require('debug')('knex:client')
var debugQuery     = require('debug')('knex:query')

// The base client provides the general structure
// for a dialect specific client object.
function Client(config = {}) {
  this.config = config
  this.connectionSettings = cloneDeep(config.connection || {})
  if (this.driverName && config.connection) {
    this.initializeDriver()
  }
  this.valueForUndefined = this.raw('DEFAULT');
  if (config.useNullAsDefault) {
    this.valueForUndefined = null
  }
}
inherits(Client, EventEmitter)

assign(Client.prototype, {

  Formatter: Formatter,

  formatter: function() {
    return new this.Formatter(this)
  },

  QueryBuilder: QueryBuilder,

  queryBuilder: function() {
    return new this.QueryBuilder(this)
  },

  QueryCompiler: QueryCompiler,

  queryCompiler: function(builder) {
    return new this.QueryCompiler(this, builder)
  },

  SchemaBuilder: SchemaBuilder,

  schemaBuilder: function() {
    return new this.SchemaBuilder(this)
  },

  SchemaCompiler: SchemaCompiler,

  schemaCompiler: function(builder) {
    return new this.SchemaCompiler(this, builder)
  },

  TableBuilder: TableBuilder,

  tableBuilder: function(type, tableName, fn) {
    return new this.TableBuilder(this, type, tableName, fn)
  },

  TableCompiler: TableCompiler,

  tableCompiler: function(tableBuilder) {
    return new this.TableCompiler(this, tableBuilder)
  },

  ColumnBuilder: ColumnBuilder,

  columnBuilder: function(tableBuilder, type, args) {
    return new this.ColumnBuilder(this, tableBuilder, type, args)
  },

  ColumnCompiler: ColumnCompiler,

  columnCompiler: function(tableBuilder, columnBuilder) {
    return new this.ColumnCompiler(this, tableBuilder, columnBuilder)
  },

  Runner: Runner,

  runner: function(connection) {
    return new this.Runner(this, connection)
  },

  SqlString: SqlString,

  Transaction: Transaction,

  transaction: function(container, config, outerTx) {
    return new this.Transaction(this, container, config, outerTx)
  },

  Raw: Raw,

  raw: function() {
    var raw = new this.Raw(this)
    return raw.set.apply(raw, arguments)
  },

  query: function(connection, obj) {
    if (typeof obj === 'string') obj = {sql: obj}
    this.emit('query', assign({__knexUid: connection.__knexUid}, obj))
    debugQuery(obj.sql)
    return this._query.call(this, connection, obj).catch(function(err) {
      err.message = SqlString.format(obj.sql, obj.bindings) + ' - ' + err.message
      throw err
    })
  },

  stream: function(connection, obj, stream, options) {
    if (typeof obj === 'string') obj = {sql: obj}
    this.emit('query', assign({__knexUid: connection.__knexUid}, obj))
    debugQuery(obj.sql)
    return this._stream.call(this, connection, obj, stream, options)
  },

  prepBindings: function(bindings) {
    return _.map(bindings, function(binding) {
      return binding === undefined ? this.valueForUndefined : binding
    }, this);
  },

  wrapIdentifier: function(value) {
    return (value !== '*' ? '"' + value.replace(/"/g, '""') + '"' : '*')
  },

  initializeDriver: function() {
    try {
      this.driver = this._driver()
    } catch (e) {
      helpers.exit('Knex: run\n$ npm install ' + this.driverName + ' --save' + '\n' + e.stack)
    }
  },

  Pool: Pool2,

  initializePool: function(config, callback) {
    var client = this
    var promise = Promise.try(function() {
      return Promise.try(function() {
        if (client.pool) {
          return client.destroy()
        }
      })
      .then(function() {
        client.pool = new client.Pool(assign(client.poolDefaults(config.pool || {}), config.pool))
        client.pool.on('error', function(err) {
          helpers.error('Pool2 - ' + err)
        })
        client.pool.on('warn', function(msg) {
          helpers.warn('Pool2 - ' + msg)
        })
      })
    })
    // Allow either a callback or promise interface for initialization.
    if (typeof callback === 'function') {
      promise.nodeify(callback)
    } else {
      return promise
    }
  },

  poolDefaults: function(poolConfig) {
    var dispose, client = this
    if (poolConfig.destroy) {
      helpers.deprecate('config.pool.destroy', 'config.pool.dispose')
      dispose = poolConfig.destroy
    }
    return {
      min: 2,
      max: 10,
      acquire: function(callback) {
        client.acquireRawConnection()
          .tap(function(connection) {
            connection.__knexUid = uniqueId('__knexUid')
            if (poolConfig.afterCreate) {
              return Promise.promisify(poolConfig.afterCreate)(connection)
            }
          })
          .nodeify(callback)
      },
      dispose: function(connection, callback) {
        if (poolConfig.beforeDestroy) {
          poolConfig.beforeDestroy(connection, function() {
            if (connection !== undefined) {
              client.destroyRawConnection(connection, callback)
            }
          })
        } else if (connection !== void 0) {
          client.destroyRawConnection(connection, callback)
        }
      }
    }
  },

  // Acquire a connection from the pool.
  acquireConnection: function(callback) {
    var client = this
    var promise = Promise.try(function() {
      if (!client.pool) {
        if (!client.config.pool || (client.config.pool && client.config.pool.max !== 0)) {
          return client.initializePool(client.config)
        }
        throw new Error('There is no pool defined on the current client')
      }
    })
    .then(function() {
      return Promise.fromNode(client.pool.acquire.bind(client.pool))
      .then(function(connection) {
        debug('acquiring connection from pool: %s', connection.__knexUid)
        return connection
      })
    })
    // Allow either a callback or promise interface for initialization.
    if (typeof callback === 'function') {
      promise.nodeify(callback)
    } else {
      return promise
    }
  },

  // Releases a connection back to the connection pool,
  // returning a promise resolved when the connection is released.
  // A callback may also be used instead of a promise.
  releaseConnection: function(connection, callback) {
    var pool = this.pool
    var promise = new Promise(function(resolver) {
      debug('releasing connection to pool: %s', connection.__knexUid)
      pool.release(connection)
      resolver()
    })
    // Allow either a callback or promise interface for releasing connections.
    if (typeof callback === 'function') {
      promise.nodeify(callback)
    } else {
      return promise
    }
  },

  // Destroy the current connection pool for the client.
  destroy: function(callback) {
    var client = this
    var promise = Promise.try(function() {
      if (!client.pool) {
        return
      }
      return Promise.fromNode(client.pool.end.bind(client.pool))
      .then(function() {
        client.pool = undefined
      })
    })
    // Allow either a callback or promise interface for destruction.
    if (typeof callback === 'function') {
      promise.nodeify(callback)
    } else {
      return promise
    }
  },

  // Return the database being used by this client.
  database: function() {
    return this.connectionSettings.database
  },

  toString: function() {
    return '[object KnexClient]'
  }

})

module.exports = Client
