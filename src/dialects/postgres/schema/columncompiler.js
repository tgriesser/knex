
// PostgreSQL Column Compiler
// -------

import inherits from 'inherits';
import ColumnCompiler from '../../../schema/columncompiler';
import * as helpers from '../../../helpers';

import { assign } from 'lodash'

function ColumnCompiler_PG() {
  ColumnCompiler.apply(this, arguments);
  this.modifiers = ['nullable', 'defaultTo', 'comment']
}
inherits(ColumnCompiler_PG, ColumnCompiler);

assign(ColumnCompiler_PG.prototype, {

  // Types
  // ------
  bigincrements({ primaryKey = true } = {}){
    return primaryKey ? 'bigserial primary key' : 'bigserial';
  },
  bigint: 'bigint',
  binary: 'bytea',

  bit(column) {
    return column.length !== false ? `bit(${column.length})` : 'bit';
  },

  bool: 'boolean',

  // Create the column definition for an enum type.
  // Using method "2" here: http://stackoverflow.com/a/10984951/525714
  enu(allowed) {
    return `text check (${this.formatter.wrap(this.args[0])} in ('${allowed.join("', '")}'))`;
  },

  double: 'double precision',
  floating: 'real',
  increments({ primaryKey = true } = {}) {
    return primaryKey ? 'serial primary key' : 'serial';
  },
  json(jsonb) {
    if (jsonb) helpers.deprecate('json(true)', 'jsonb()')
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
