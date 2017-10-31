
// MySQL Column Compiler
// -------
import inherits from 'inherits';
import ColumnCompiler from '../../../schema/columncompiler';
import * as helpers from '../../../helpers';

import { assign } from 'lodash'

function ColumnCompiler_MSSQL() {
  ColumnCompiler.apply(this, arguments);
  this.modifiers = ['nullable', 'defaultTo', 'first', 'after', 'comment']
}
inherits(ColumnCompiler_MSSQL, ColumnCompiler);

// Types
// ------

assign(ColumnCompiler_MSSQL.prototype, {

  increments({ primaryKey = true } = {}){
    return primaryKey ?
      'int identity(1,1) not null primary key' :
      'int identity(1,1) not null';
  },

  bigincrements({ primaryKey = true } = {}){
    return primaryKey ?
      'bigint identity(1,1) not null primary key' :
      'bigint identity(1,1) not null';
  },

  bigint: 'bigint',

  double(precision, scale) {
    if (!precision) return 'decimal'
    return `decimal(${this._num(precision, 8)}, ${this._num(scale, 2)})`
  },

  floating(precision, scale) {
    if (!precision) return 'decimal'
    return `decimal(${this._num(precision, 8)}, ${this._num(scale, 2)})`
  },

  integer(length) {
    length = length ? `(${this._num(length, 11)})` : ''
    return `int${length}`
  },

  mediumint: 'int',

  smallint: 'smallint',

  tinyint(length) {
    length = length ? `(${this._num(length, 1)})` : ''
    return `tinyint${length}`
  },

  varchar(length) {
    return `nvarchar(${this._num(length, 255)})`;
  },

  text: 'nvarchar(max)',

  mediumtext: 'nvarchar(max)',

  longtext: 'nvarchar(max)',

  enu: 'nvarchar(100)',

  uuid: 'uniqueidentifier',

  datetime: 'datetime',

  timestamp: 'datetime',

  bit(length) {
    if (length > 1) {
      helpers.warn('Bit field is exactly 1 bit length for MSSQL');
    }
    return 'bit';
  },

  binary(length) {
    return length ? `varbinary(${this._num(length)})` : 'varbinary(max)'
  },

  bool: 'bit',

  // Modifiers
  // ------

  defaultTo(value) {
    const defaultVal = ColumnCompiler_MSSQL.super_.prototype.defaultTo.apply(this, arguments);
    if (this.type !== 'blob' && this.type.indexOf('text') === -1) {
      return defaultVal
    }
    return ''
  },

  first() {
    helpers.warn('Column first modifier not available for MSSQL');
    return '';
  },

  after(column) {
    helpers.warn('Column after modifier not available for MSSQL');
    return '';
  },

  comment(comment) {
    if (comment && comment.length > 255) {
      helpers.warn('Your comment is longer than the max comment length for MSSQL')
    }
    return ''
  }

})

export default ColumnCompiler_MSSQL;
