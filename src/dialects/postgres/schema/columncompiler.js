
// PostgreSQL Column Compiler
// -------

import inherits from 'inherits';
import ColumnCompiler from '../../../schema/columncompiler';

import { assign } from 'lodash'

function ColumnCompiler_PG() {
  ColumnCompiler.apply(this, arguments);
  this.modifiers = ['nullable', 'defaultTo', 'comment', 'check']
}
inherits(ColumnCompiler_PG, ColumnCompiler);

assign(ColumnCompiler_PG.prototype, {

  // Types
  // ------
  bigincrements: 'bigserial primary key',
  bigint: 'bigint',
  binary: 'bytea',

  bit(column) {
    return column.length !== false ? `bit(${column.length})` : 'bit';
  },

  bool: 'boolean',

  // Create the column definition for an enum type.
  // Using method "2" here: http://stackoverflow.com/a/10984951/525714
  enu(allowed, options) {
    options = options || {};

    const values = allowed.join("', '");

    if (options.useNative) {
      this.tableCompiler.unshiftQuery(`create type "${options.enumName}" as enum ('${values}')`);

      return `"${options.enumName}"`;
    }
    return `text check (${this.formatter.wrap(this.args[0])} in ('${values}'))`;
  },

  double: 'double precision',
  decimal(precision, scale) {
    if (precision === null) return 'decimal';
    return `decimal(${this._num(precision, 8)}, ${this._num(scale, 2)})`;
  },
  floating: 'real',
  increments: 'serial primary key',
  json(jsonb) {
    if (jsonb) this.client.logger.deprecate('json(true)', 'jsonb()')
    return jsonColumn(this.client, jsonb);
  },
  jsonb() {
    return jsonColumn(this.client, true);
  },
  smallint: 'smallint',
  tinyint:  'smallint',
  datetime(without) {
    return without ? 'timestamp' : 'timestamptz';
  },
  timestamp(without) {
    return without ? 'timestamp' : 'timestamptz';
  },
  uuid: 'uuid',

  // Modifiers:
  // ------
  comment(comment) {
    const columnName = this.args[0] || this.defaults('columnName');

    this.pushAdditional(function() {
      this.pushQuery(`comment on column ${this.tableCompiler.tableName()}.` +
        this.formatter.wrap(columnName) + " is " + (comment ? `'${comment}'` : 'NULL'));
    }, comment);
  }

})

function jsonColumn(client, jsonb) {
  if (!client.version || parseFloat(client.version) >= 9.2) return jsonb ? 'jsonb' : 'json';
  return 'text';
}

export default ColumnCompiler_PG;
