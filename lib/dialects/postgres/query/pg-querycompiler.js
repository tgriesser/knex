// PostgreSQL Query Builder & Compiler
// ------
const identity = require('lodash/identity');
const reduce = require('lodash/reduce');

const Ref = require('../../../ref');
const QueryCompiler = require('../../../query/querycompiler');
const { wrapString } = require('../../../formatter/wrappingFormatter');

class QueryCompiler_PG extends QueryCompiler {
  constructor(client, builder, formatter) {
    super(client, builder, formatter);
    this._defaultInsertValue = 'default';
  }

  // Compiles a truncate query.
  truncate() {
    return `truncate ${this.tableName} restart identity`;
  }

  // is used if the an array with multiple empty values supplied

  // Compiles an `insert` query, allowing for multiple
  // inserts using a single query statement.
  insert() {
    let sql = super.insert();
    if (sql === '') return sql;

    const { returning, onConflict, ignore, merge, insert } = this.single;
    if (onConflict && ignore) sql += this._ignore(onConflict);
    if (onConflict && merge) {
      sql += this._merge(merge.updates, onConflict, insert);
      const wheres = this.where();
      if (wheres) sql += ` ${wheres}`;
    }
    if (returning) sql += this._returning(returning);

    return {
      sql: sql,
      returning,
    };
  }

  // Compiles an `update` query, allowing for a return value.
  update() {
    const withSQL = this.with();
    const updateData = this._prepUpdate(this.single.update);
    const wheres = this.where();
    const { returning } = this.single;
    return {
      sql:
        withSQL +
        `update ${this.single.only ? 'only ' : ''}${this.tableName} ` +
        `set ${updateData.join(', ')}` +
        (wheres ? ` ${wheres}` : '') +
        this._returning(returning),
      returning,
    };
  }

  // Compiles an `delete` query, allowing for a return value.
  del() {
    const sql = super.del(...arguments);
    const { returning } = this.single;
    return {
      sql: sql + this._returning(returning),
      returning,
    };
  }

  aggregate(stmt) {
    return this._aggregate(stmt, { distinctParentheses: true });
  }

  _returning(value) {
    return value ? ` returning ${this.formatter.columnize(value)}` : '';
  }

  _ignore(columns) {
    return ` on conflict (${this.formatter.columnize(columns)}) do nothing`;
  }

  _merge(updates, columns, insert) {
    let sql = ` on conflict (${this.formatter.columnize(
      columns
    )}) do update set `;
    if (updates && Array.isArray(updates)) {
      sql += updates
        .map((column) =>
          wrapString(
            column.split('.').pop(),
            this.formatter.builder,
            this.client,
            this.formatter
          )
        )
        .map((column) => `${column} = excluded.${column}`)
        .join(', ');

      return sql;
    } else if (updates && typeof updates === 'object') {
      const updateData = this._prepUpdate(updates);
      if (typeof updateData === 'string') {
        sql += updateData;
      } else {
        sql += updateData.join(',');
      }

      return sql;
    } else {
      const insertData = this._prepInsert(insert);
      if (typeof insertData === 'string') {
        throw new Error(
          'If using merge with a raw insert query, then updates must be provided'
        );
      }

      sql += insertData.columns
        .map((column) =>
          wrapString(column.split('.').pop(), this.builder, this.client)
        )
        .map((column) => `${column} = excluded.${column}`)
        .join(', ');

      return sql;
    }
  }

  // Join array of table names and apply default schema.
  _tableNames(tables) {
    const schemaName = this.single.schema;
    const sql = [];

    for (let i = 0; i < tables.length; i++) {
      let tableName = tables[i];

      if (tableName) {
        if (schemaName) {
          tableName = `${schemaName}.${tableName}`;
        }
        sql.push(this.formatter.wrap(tableName));
      }
    }

    return sql.join(', ');
  }

  forUpdate() {
    const tables = this.single.lockTables || [];

    return (
      'for update' + (tables.length ? ' of ' + this._tableNames(tables) : '')
    );
  }

  forShare() {
    const tables = this.single.lockTables || [];

    return (
      'for share' + (tables.length ? ' of ' + this._tableNames(tables) : '')
    );
  }

  skipLocked() {
    return 'skip locked';
  }

  noWait() {
    return 'nowait';
  }

  // Compiles a columnInfo query
  columnInfo() {
    const column = this.single.columnInfo;
    let schema = this.single.schema;
    let table = this.single.table;

    // Ref can define the tableName and schema
    if (table instanceof Ref) {
      schema = table._schema;
      table = table.ref;
    }

    // The user may have specified a custom wrapIdentifier function in the config. We
    // need to run the identifiers through that function, but not format them as
    // identifiers otherwise.
    table = this.client.customWrapIdentifier(table, identity);

    if (schema) {
      schema = this.client.customWrapIdentifier(schema, identity);
    }

    let sql =
      'select * from information_schema.columns where table_name = ? and table_catalog = ?';
    const bindings = [`${table}`, this.client.database()];

    if (schema) {
      sql += ' and table_schema = ?';
      bindings.push(schema);
    } else {
      sql += ' and table_schema = current_schema()';
    }

    return {
      sql,
      bindings,
      output(resp) {
        const out = reduce(
          resp.rows,
          function (columns, val) {
            columns[val.column_name] = {
              type: val.data_type,
              maxLength: val.character_maximum_length,
              nullable: val.is_nullable === 'YES',
              defaultValue: val.column_default,
            };
            return columns;
          },
          {}
        );
        return (column && out[column]) || out;
      },
    };
  }

  distinctOn(value) {
    return 'distinct on (' + this.formatter.columnize(value) + ') ';
  }
}

module.exports = QueryCompiler_PG;
