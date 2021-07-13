// CockroachDB Client
// -------
const Client_PostgreSQL = require('../postgres');
const Transaction = require('../postgres/execution/pg-transaction');

// Always initialize with the "QueryBuilder" and "QueryCompiler"
// objects, which extend the base 'lib/query/builder' and
// 'lib/query/compiler', respectively.
class Client_CockroachDB extends Client_PostgreSQL {
  transaction() {
    return new Transaction(this, ...arguments);
  }

  _parseVersion(versionString) {
    return versionString.split(' ')[2];
  }
}

Object.assign(Client_CockroachDB.prototype, {
  // The "dialect", for reference elsewhere.
  driverName: 'cockroachdb',
});

module.exports = Client_CockroachDB;
