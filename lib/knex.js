const log = require('anylogger')('knex');
const Raw = require('./raw');
const Client = require('./client');
const QueryBuilder = require('./query/builder');
const QueryInterface = require('./query/methods');

const makeKnex = require('./util/make-knex');
const parseConnection = require('./util/parse-connection');
const { KnexTimeoutError } = require('./util/timeout');
const fakeClient = require('./util/fake-client');
const { SUPPORTED_CLIENTS } = require('./constants');
const { resolveClientNameWithAliases } = require('./helpers');

function Knex(config) {
  // If config is a string, try to parse it
  if (typeof config === 'string') {
    const parsedConfig = Object.assign(parseConnection(config), arguments[2]);
    return new Knex(parsedConfig);
  }

  let Dialect;
  // If user provided no relevant parameters, use generic client
  if (arguments.length === 0 || (!config.client && !config.dialect)) {
    Dialect = Client;
  }

  // If user provided Client constructor as a parameter, use it
  else if (
    typeof config.client === 'function' &&
    config.client.prototype instanceof Client
  ) {
    Dialect = config.client;
  }

  // If neither applies, let's assume user specified name of a client or dialect as a string
  else {
    const clientName = config.client || config.dialect;
    if (!SUPPORTED_CLIENTS.includes(clientName)) {
      throw new Error(
        `knex: Unknown configuration option 'client' value ${clientName}. Note that it is case-sensitive, check documentation for supported values.`
      );
    }

    const resolvedClientName = resolveClientNameWithAliases(clientName);
    Dialect = require(`./dialects/${resolvedClientName}/index.js`);
  }

  // If config connection parameter is passed as string, try to parse it
  if (typeof config.connection === 'string') {
    config = Object.assign({}, config, {
      connection: parseConnection(config.connection).connection,
    });
  }
  const newKnex = makeKnex(new Dialect(config));
  if (config.userParams) {
    newKnex.userParams = config.userParams;
  }
  return newKnex;
}

// Expose Client on the main Knex namespace.
Knex.Client = Client;

Knex.KnexTimeoutError = KnexTimeoutError;

Knex.QueryBuilder = {
  extend: function (methodName, fn) {
    QueryBuilder.extend(methodName, fn);
    QueryInterface.push(methodName);
  },
};

// Run a "raw" query, though we can't do anything with it other than put
// it in a query statement.
Knex.raw = (sql, bindings) => {
  log.warn(
    'global Knex.raw is deprecated, use knex.raw (chain off an initialized knex object)'
  );
  return new Raw(fakeClient).set(sql, bindings);
};

module.exports = Knex;
