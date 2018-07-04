
// MySQL Schema Compiler
// -------
import inherits from 'inherits';
import SchemaCompiler from '../../../schema/compiler';

import { assign } from 'lodash'

function SchemaCompiler_MSSQL(client, builder) {
  SchemaCompiler.call(this, client, builder)
}
inherits(SchemaCompiler_MSSQL, SchemaCompiler)

assign(SchemaCompiler_MSSQL.prototype, {

  dropTablePrefix: 'DROP TABLE ',
  dropTableIfExists(tableName) {
    const name = this.formatter.wrap(prefixedTableName(this.schema, tableName));
    this.pushQuery(`if object_id('${name}', 'U') is not null DROP TABLE ${name}`);
  },

  // Rename a table on the schema.
  renameTable(tableName, to) {
    this.pushQuery(
      `exec sp_rename ${this.formatter.parameter(tableName)}, ${this.formatter.parameter(to)}`
    );
  },

  // Check whether a table exists on the query.
  hasTable(tableName) {
    const sql =
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES ` +
      `WHERE TABLE_NAME = '${tableName}'`;
    this.pushQuery({ sql, output: resp => resp.length > 0 });
  },

  // Check whether a column exists on the schema.
  hasColumn(tableName, column) {
    const formattedColumn = this.formatter.parameter(column);
    const formattedTable = this.formatter.parameter(this.formatter.wrap(tableName));
    const sql =
      `select object_id from sys.columns ` +
      `where name = ${formattedColumn} ` +
      `and object_id = object_id(${formattedTable})`;
    this.pushQuery({ sql, output: resp => resp.length > 0 });
  }

})

function prefixedTableName(prefix, table) {
  return prefix ? `${prefix}.${table}` : table;
}

export default SchemaCompiler_MSSQL;
