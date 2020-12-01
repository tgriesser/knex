'use strict';
const tape = require('tape');
const debug = require('anylogger')('knex:tests');

module.exports = function (tableName, knex) {
  return function (name, dialects, cb) {
    if (arguments.length === 2) {
      cb = dialects;
    } else {
      if (!Array.isArray(dialects)) {
        dialects = [dialects];
      }
      if (dialects.indexOf(knex.client.dialect) === -1) {
        debug('Skipping dialect ' + knex.client.dialect + ' for test ' + name);
        return;
      }
    }

    return tape(name, async function (t) {
      const val = cb(t);
      try {
        if (!val || typeof val.then !== 'function') {
          throw new Error('A promise should be returned to test ' + name);
        }

        await val;
      } catch (err) {
        t.error(err);
      } finally {
        await knex.truncate(tableName).catch((e) => t.fail(e));
        t.end();
      }
    });
  };
};
