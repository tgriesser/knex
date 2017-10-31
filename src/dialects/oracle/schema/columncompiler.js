
import { assign, uniq, map } from 'lodash'
import inherits from 'inherits';
import Raw from '../../../raw';
import ColumnCompiler from '../../../schema/columncompiler';
import Trigger from './trigger';

// Column Compiler
// -------

function ColumnCompiler_Oracle() {
  ColumnCompiler.apply(this, arguments);
  this.modifiers = ['defaultTo', 'checkIn', 'nullable', 'comment'];
}
inherits(ColumnCompiler_Oracle, ColumnCompiler);

assign(ColumnCompiler_Oracle.prototype, {

  // helper function for pushAdditional in increments() and bigincrements()
  _createAutoIncrementTriggerAndSequence () {
    // TODO Add warning that sequence etc is created
    this.pushAdditional(function () {
      const tableName = this.tableCompiler.tableNameRaw;
      const createTriggerSQL = Trigger.createAutoIncrementTrigger(tableName);
      this.pushQuery(createTriggerSQL);
    });
  },

  increments ({ primaryKey = true } = {}) {
    this._createAutoIncrementTriggerAndSequence();
    return primaryKey ? 'integer not null primary key' : 'integer not null';
  },

  bigincrements ({ primaryKey = true } = {}) {
    this._createAutoIncrementTriggerAndSequence();
    return primaryKey ? 'number(20, 0) not null primary key' : 'number(20, 0) not null';
  },

  floating(precision) {
    const parsedPrecision = this._num(precision, 0);
    return `float${parsedPrecision ? `(${parsedPrecision})` : ''}`;
  },

  double(precision, scale) {
    // if (!precision) return 'number'; // TODO: Check If default is ok
    return `number(${this._num(precision, 8)}, ${this._num(scale, 2)})`;
  },

  integer(length) {
    return length ? `number(${this._num(length, 11)})` : 'integer';
  },

  tinyint: 'smallint',

  smallint: 'smallint',

  mediumint: 'integer',

  biginteger: 'number(20, 0)',

  text: 'clob',

  enu (allowed) {
    allowed = uniq(allowed);
    const maxLength = (allowed || []).reduce((maxLength, name) =>
      Math.max(maxLength, String(name).length)
    , 1);

    // implicitly add the enum values as checked values
    this.columnBuilder._modifiers.checkIn = [allowed];

    return `varchar2(${maxLength})`;
  },

  time: 'timestamp with time zone',

  datetime(without) {
    return without ? 'timestamp' : 'timestamp with time zone';
  },

  timestamp(without) {
    return without ? 'timestamp' : 'timestamp with time zone';
  },

  bit: 'clob',

  json: 'clob',

  bool () {
    // implicitly add the check for 0 and 1
    this.columnBuilder._modifiers.checkIn = [[0, 1]];
    return 'number(1, 0)';
  },

  varchar(length) {
    return `varchar2(${this._num(length, 255)})`;
  },

  // Modifiers
  // ------

  comment(comment) {
    const columnName = this.args[0] || this.defaults('columnName');

    this.pushAdditional(function() {
      this.pushQuery(`comment on column ${this.tableCompiler.tableName()}.` +
        this.formatter.wrap(columnName) + " is '" + (comment || '')+ "'");
    }, comment);
  },

  checkIn (value) {
    // TODO: Maybe accept arguments also as array
    // TODO: value(s) should be escaped properly
    if (value === undefined) {
      return '';
    } else if (value instanceof Raw) {
      value = value.toQuery();
    } else if (Array.isArray(value)) {
      value = map(value, v => `'${v}'`).join(', ');
    } else {
      value = `'${value}'`;
    }
    return `check (${this.formatter.wrap(this.args[0])} in (${value}))`;
  }

});

export default ColumnCompiler_Oracle;
