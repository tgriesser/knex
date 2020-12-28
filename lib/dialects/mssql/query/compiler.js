// MSSQL Query Compiler
// ------
const QueryCompiler = require('../../../query/compiler');

const compact = require('lodash/compact');
const identity = require('lodash/identity');
const isEmpty = require('lodash/isEmpty');

const components = [
  'columns',
  'join',
  'lock',
  'where',
  'union',
  'group',
  'having',
  'order',
  'limit',
  'offset',
];

class QueryCompiler_MSSQL extends QueryCompiler {
  constructor(client, builder) {
    super(client, builder);

    const { onConflict } = this.single;
    if (onConflict) {
      throw new Error('.onConflict() is not supported for mssql.');
    }

    this._emptyInsertValue = 'default values';
  }

  select() {
    const sql = this.with();
    const statements = components.map((component) => this[component](this));
    return sql + compact(statements).join(' ');
  }

  //#region Insert
  // Compiles an "insert" query, allowing for multiple
  // inserts using a single query statement.
  insert() {
    if (this.single.options && this.single.options.includeTriggerModifications) {
      return this.insertWithTriggers();
    } else {
      return this.standardInsert();
    }
  }

  insertWithTriggers() {
    const insertValues = this.single.insert || [];
    const { returning } = this.single;
    let sql = this.with() + `${this._buildTempTable(returning)}insert into ${this.tableName} `;
    const returningSql = returning
      ? this._returning('insert', returning, true) + ' '
      : '';

    if (Array.isArray(insertValues)) {
      if (insertValues.length === 0) {
        return '';
      }
    } else if (typeof insertValues === 'object' && isEmpty(insertValues)) {
      return {
        sql: sql + returningSql + this._emptyInsertValue + this._buildReturningSelect(returning),
        returning,
      };
    }

    const insertData = this._prepInsert(insertValues);
    if (typeof insertData === 'string') {
      sql += insertData;
    } else {
      if (insertData.columns.length) {
        sql += `(${this.formatter.columnize(insertData.columns)}`;
        sql += `) ${returningSql}values (`;
        let i = -1;
        while (++i < insertData.values.length) {
          if (i !== 0) sql += '), (';
          sql += this.formatter.parameterize(
            insertData.values[i],
            this.client.valueForUndefined
          );
        }
        sql += ')';
      } else if (insertValues.length === 1 && insertValues[0]) {
        sql += returningSql + this._emptyInsertValue;
      } else {
        sql = '';
      }
    }

    if (returning) {
      sql += this._buildReturningSelect(returning);
    }

    return {
      sql,
      returning,
    };
  }

  standardInsert() {
    const insertValues = this.single.insert || [];
    let sql = this.with() + `insert into ${this.tableName} `;
    const { returning } = this.single;
    const returningSql = returning
      ? this._returning('insert', returning) + ' '
      : '';

    if (Array.isArray(insertValues)) {
      if (insertValues.length === 0) {
        return '';
      }
    } else if (typeof insertValues === 'object' && isEmpty(insertValues)) {
      return {
        sql: sql + returningSql + this._emptyInsertValue,
        returning,
      };
    }

    const insertData = this._prepInsert(insertValues);
    if (typeof insertData === 'string') {
      sql += insertData;
    } else {
      if (insertData.columns.length) {
        sql += `(${this.formatter.columnize(insertData.columns)}`;
        sql += `) ${returningSql}values (`;
        let i = -1;
        while (++i < insertData.values.length) {
          if (i !== 0) sql += '), (';
          sql += this.formatter.parameterize(
            insertData.values[i],
            this.client.valueForUndefined
          );
        }
        sql += ')';
      } else if (insertValues.length === 1 && insertValues[0]) {
        sql += returningSql + this._emptyInsertValue;
      } else {
        sql = '';
      }
    }

    return {
      sql,
      returning,
    };
  }
  //#endregion

  //#region Update
  // Compiles an `update` query, allowing for a return value.
  update() {
    if (this.single.options && this.single.options.includeTriggerModifications) {
      return this.updateWithTriggers();
    } else {
      return this.standardUpdate();
    }
  }

  updateWithTriggers() {
    const top = this.top();
    const withSQL = this.with();
    const updates = this._prepUpdate(this.single.update);
    const join = this.join();
    const where = this.where();
    const order = this.order();
    const { returning } = this.single;
    const declaredTemp = this._buildTempTable(returning);
    return {
      sql:
        withSQL +
        declaredTemp +
        `update ${top ? top + ' ' : ''}${this.tableName}` +
        ' set ' +
        updates.join(', ') +
        (returning ? ` ${this._returning('update', returning, true)}` : '') +
        (join ? ` from ${this.tableName} ${join}` : '') +
        (where ? ` ${where}` : '') +
        (order ? ` ${order}` : '') +
        (!returning
          ? this._returning('rowcount', '@@rowcount')
          : this._buildReturningSelect(returning)),
      returning: returning || '@@rowcount',
    };
  }

  standardUpdate() {
    const top = this.top();
    const withSQL = this.with();
    const updates = this._prepUpdate(this.single.update);
    const join = this.join();
    const where = this.where();
    const order = this.order();
    const { returning } = this.single;
    return {
      sql:
        withSQL +
        `update ${top ? top + ' ' : ''}${this.tableName}` +
        ' set ' +
        updates.join(', ') +
        (returning ? ` ${this._returning('update', returning)}` : '') +
        (join ? ` from ${this.tableName} ${join}` : '') +
        (where ? ` ${where}` : '') +
        (order ? ` ${order}` : '') +
        (!returning
          ? this._returning('rowcount', '@@rowcount')
          : ""),
      returning: returning || '@@rowcount',
    };
  }
  //#endregion

  //#region Delete
  // Compiles a `delete` query.
  del() {
    if (this.single.options && this.single.options.includeTriggerModifications) {
      return this.deleteWithTriggers();
    } else {
      return this.standardDelete();
    }
  }

  deleteWithTriggers() {
    // Make sure tableName is processed by the formatter first.
    const withSQL = this.with();
    const { tableName } = this;
    const wheres = this.where();
    const { returning } = this.single;
    return {
      sql:
        withSQL +
        `${this._buildTempTable(returning)}delete from ${tableName}` +
        (returning ? ` ${this._returning('del', returning, true)}` : '') +
        (wheres ? ` ${wheres}` : '') +
        (!returning ? this._returning('rowcount', '@@rowcount') : this._buildReturningSelect(returning)),
      returning: returning || '@@rowcount',
    };
  }

  standardDelete() {
    // Make sure tableName is processed by the formatter first.
    const withSQL = this.with();
    const { tableName } = this;
    const wheres = this.where();
    const { returning } = this.single;
    return {
      sql:
        withSQL +
        `delete from ${tableName}` +
        (returning ? ` ${this._returning('del', returning)}` : '') +
        (wheres ? ` ${wheres}` : '') +
        (!returning ? this._returning('rowcount', '@@rowcount') : ""),
      returning: returning || '@@rowcount',
    };
  }
  //#endregion

  // Compiles the columns in the query, specifying if an item was distinct.
  columns() {
    let distinctClause = '';
    if (this.onlyUnions()) return '';
    const top = this.top();
    const columns = this.grouped.columns || [];
    let i = -1,
      sql = [];
    if (columns) {
      while (++i < columns.length) {
        const stmt = columns[i];
        if (stmt.distinct) distinctClause = 'distinct ';
        if (stmt.distinctOn) {
          distinctClause = this.distinctOn(stmt.value);
          continue;
        }
        if (stmt.type === 'aggregate') {
          sql.push(...this.aggregate(stmt));
        } else if (stmt.type === 'aggregateRaw') {
          sql.push(this.aggregateRaw(stmt));
        } else if (stmt.value && stmt.value.length > 0) {
          sql.push(this.formatter.columnize(stmt.value));
        }
      }
    }
    if (sql.length === 0) sql = ['*'];

    return (
      `select ${distinctClause}` +
      (top ? top + ' ' : '') +
      sql.join(', ') +
      (this.tableName ? ` from ${this.tableName}` : '')
    );
  }

  _returning(method, value, withTrigger) {
    switch (method) {
      case 'update':
      case 'insert':
        return value
          ? `output ${this.formatter.columnizeWithPrefix('inserted.', value)}${withTrigger ? " into #out" : ""}`
          : '';
      case 'del':
        return value
          ? `output ${this.formatter.columnizeWithPrefix('deleted.', value)}${withTrigger ? " into #out" : ""}`
          : '';
      case 'rowcount':
        return value ? ';select @@rowcount' : '';
    }
  }

  _buildTempTable(values) {
    // If value is nothing then return an empty string
    if (values && values.length > 0) {
      let selections = "";

      // Build values that will be returned from this procedure
      if (Array.isArray(values)) {
        selections = values.map(value => `[t].${this.formatter.columnize(value)}`).join(",");
      } else {
        selections = `[t].${this.formatter.columnize(values)}`;
      }

      // Force #out to be correctly populated with the correct column structure.
      let sql = `select top(0) ${selections} into #out `;
      sql += `from ${this.tableName} as t `;
      sql += `left join ${this.tableName} on 0=1;`;

      return sql;
    }

    return '';
  }

  _buildReturningSelect(values) {
    // If value is nothing then return an empty string
    if (values && values.length > 0) {
      let selections = "";

      // Build columns to return
      if (Array.isArray(values)) {
        selections = values.map(value => `${this.formatter.columnize(value)}`).join(",");
      } else {
        selections = this.formatter.columnize(values);
      }

      // Get the returned values
      let sql = `; select ${selections} from #out; `
      // Drop the temp table to prevent memory leaks
      sql += `drop table #out;`;

      return sql;
    }

    return '';
  }

  // Compiles a `truncate` query.
  truncate() {
    return `truncate table ${this.tableName}`;
  }

  forUpdate() {
    // this doesn't work exacltly as it should, one should also mention index while locking
    // https://stackoverflow.com/a/9818448/360060
    return 'with (UPDLOCK)';
  }

  forShare() {
    // http://www.sqlteam.com/article/introduction-to-locking-in-sql-server
    return 'with (HOLDLOCK)';
  }

  // Compiles a `listTables` query
  listTables() {
    let schema = this.single.schema;

    if (schema) {
      schema = this.client.customWrapIdentifier(schema, identity);
    }

    let sql = `select table_name from information_schema.tables where `;
    const bindings = [];

    if (schema) {
      sql += 'table_schema = ? and ';
      bindings.push(schema);
    } else {
      sql += `table_schema = 'dbo' and `;
    }

    sql += `table_catalog = ?`;
    bindings.push(this.client.database());

    return {
      sql: sql,
      bindings: bindings,
      output(resp) {
        return resp.map((table) => {
          return table.table_name;
        });
      },
    };
  }

  // Compiles a `columnInfo` query.
  columnInfo() {
    const column = this.single.columnInfo;
    let schema = this.single.schema;

    // The user may have specified a custom wrapIdentifier function in the config. We
    // need to run the identifiers through that function, but not format them as
    // identifiers otherwise.
    const table = this.client.customWrapIdentifier(this.single.table, identity);

    if (schema) {
      schema = this.client.customWrapIdentifier(schema, identity);
    }

    let sql = `select * from information_schema.columns where table_name = ? and table_catalog = ?`;
    const bindings = [table, this.client.database()];

    if (schema) {
      sql += ' and table_schema = ?';
      bindings.push(schema);
    } else {
      sql += ` and table_schema = 'dbo'`;
    }

    return {
      sql,
      bindings: bindings,
      output(resp) {
        const out = resp.reduce(function (columns, val) {
          columns[val.COLUMN_NAME] = {
            defaultValue: val.COLUMN_DEFAULT,
            type: val.DATA_TYPE,
            maxLength: val.CHARACTER_MAXIMUM_LENGTH,
            nullable: val.IS_NULLABLE === 'YES',
          };
          return columns;
        }, {});
        return (column && out[column]) || out;
      },
    };
  }

  top() {
    const noLimit = !this.single.limit && this.single.limit !== 0;
    const noOffset = !this.single.offset;
    if (noLimit || !noOffset) return '';
    return `top (${this.formatter.parameter(this.single.limit)})`;
  }

  limit() {
    return '';
  }

  offset() {
    const noLimit = !this.single.limit && this.single.limit !== 0;
    const noOffset = !this.single.offset;
    if (noOffset) return '';
    let offset = `offset ${noOffset ? '0' : this.formatter.parameter(this.single.offset)
      } rows`;
    if (!noLimit) {
      offset += ` fetch next ${this.formatter.parameter(
        this.single.limit
      )} rows only`;
    }
    return offset;
  }
}

// Set the QueryBuilder & QueryCompiler on the client object,
// in case anyone wants to modify things to suit their own purposes.
module.exports = QueryCompiler_MSSQL;
