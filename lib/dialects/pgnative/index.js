// PostgreSQL Native Driver (pg-native)
// -------
const Client_PG = require('../postgres');

class Client_PgNative extends Client_PG {
  acquireRawConnection() {
    const client = this;
    return new Promise(function (resolver, rejecter) {
      const connection = new client.driver.Client(client.connectionSettings);

      connection.connect(function (err) {
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

  _driver() {
    return require('pg').native;
  }
}

Client_PgNative.prototype.driverName = 'pgnative';

module.exports = Client_PgNative;
