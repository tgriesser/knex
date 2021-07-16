// MySQL2 Client
// -------
const findIndex = require('lodash/findIndex');
const Client_MySQL = require('../mysql');
const Transaction = require('./transaction');

// Always initialize with the "QueryBuilder" and "QueryCompiler"
// objects, which extend the base 'lib/query/builder' and
// 'lib/query/compiler', respectively.
class Client_MySQL2 extends Client_MySQL {
  transaction() {
    return new Transaction(this, ...arguments);
  }

  _driver() {
    return require('mysql2');
  }
  validateConnection(connection) {
    if (connection._fatalError) {
      return false;
    }
    return true;
  }

  _cancelQueuedQuery(connectionToKill, queryToKill) {
    const index = findIndex(
      connectionToKill._commands.toArray(),
      (cmd) => cmd === queryToKill.__query
    );
    if (index >= 0) {
      connectionToKill._commands.removeOne(index);
      return true;
    }
    return false;
  }
}

Object.assign(Client_MySQL2.prototype, {
  // The "dialect", for reference elsewhere.
  driverName: 'mysql2',
});

module.exports = Client_MySQL2;
