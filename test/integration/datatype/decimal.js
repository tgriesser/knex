'use strict';

const { expect } = require('chai');

module.exports = function (knex) {
  it('#test decimal mssql should not allow large numbers', function () {
    // https://github.com/tediousjs/tedious/issues/1058
    if (!/mssql/i.test(knex.client.driverName)) {
      return Promise.resolve();
    }
    const tableName = 'decimal_test';
    const testDecimal = 10000000000005.74;
    return knex
      .transaction(function (tr) {
        return tr.schema.dropTableIfExists(tableName).then(function () {
          return tr.schema.createTable(tableName, function (table) {
            table.decimal('largeDecimal', 38, 10);
          });
        });
      })
      .then(function () {
        return knex(tableName).insert({
          largeDecimal: testDecimal,
        });
      })
      .then(function () {
        throw new Error('Test should throw an error');
      })
      .catch(function (err) {
        expect(err).to.be.an.instanceof(Error);
        expect(err.message).to.contain(
          'cannot be stored by mssql driver, see https://github.com/tediousjs/tedious/issues/1058'
        );
      });
  });
};
