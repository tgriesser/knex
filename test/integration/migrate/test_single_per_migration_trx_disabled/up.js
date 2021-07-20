'use strict';

const { isPostgreSQL } = require('../../../util/db-helpers');

exports.up = async function (knex) {
  if (isPostgreSQL(knex)) {
    const first = (await knex.schema.raw('SELECT txid_current()')).rows[0]
      .txid_current;
    const second = (await knex.schema.raw('SELECT txid_current()')).rows[0]
      .txid_current;
    if (first === second) {
      throw new Error('Should not be called within transaction');
    }
  }
};

exports.down = async function () {};

exports.config = {
  transaction: false,
};
