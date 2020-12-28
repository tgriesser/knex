// MySQL Query Compiler
// ------
const QueryCompiler = require('../../../query/compiler');

const identity = require('lodash/identity');

class QueryCompiler_MySQL extends QueryCompiler {
  constructor(client, builder) {
    super(client, builder);

    const { returning } = this.single;
    if (returning) {
      this.client.logger.warn(
        '.returning() is not supported by mysql and will not have any effect.'
      );
    }

    this._emptyInsertValue = '() values ()';
  }

  // Compiles an `insert` query, allowing for multiple
  // inserts using a single query statement.
  insert() {
    let sql = super.insert();
    if (sql === '') return sql;

    const { ignore, merge, insert } = this.single;
    if (ignore) sql = sql.replace('insert into', 'insert ignore into');
    if (merge) {
      sql += this._merge(merge.updates, insert);
      const wheres = this.where();
      if (wheres) {
        throw new Error('.onConflict().merge().where() is not supported for mysql');
      }
    }

    return sql;
  }

  _merge(updates, insert) {
    let sql = ' on duplicate key update ';
    if (updates) {
      const updateData = this._prepUpdate(updates);
      return sql + updateData.join(',');
    } else {
      const insertData = this._prepInsert(insert);
      if (typeof insertData === 'string') {
        throw new Error(
          'If using merge with a raw insert query, then updates must be provided'
        );
      }

      sql += insertData.columns
        .map((column) => this.formatter.wrapAsIdentifier(column))
        .map((column) => `${column} = values(${column})`)
        .join(', ');

      return sql;
    }
  }

  // Update method, including joins, wheres, order & limits.
  update() {
    const join = this.join();
    const updates = this._prepUpdate(this.single.update);
    const where = this.where();
    const order = this.order();
    const limit = this.limit();
    return (
      `update ${this.tableName}` +
      (join ? ` ${join}` : '') +
      ' set ' +
      updates.join(', ') +
      (where ? ` ${where}` : '') +
      (order ? ` ${order}` : '') +
      (limit ? ` ${limit}` : '')
    );
  }

  forUpdate() {
    return 'for update';
  }

  forShare() {
    return 'lock in share mode';
  }

  // Only supported on MySQL 8.0+
  skipLocked() {
    return 'skip locked';
  }

  // Supported on MySQL 8.0+ and MariaDB 10.3.0+
  noWait() {
    return 'nowait';
  }

  // Compiles a `listTables` query
  listTables() {
    return {
      sql: `select TABLE_NAME, ENGINE, TABLE_SCHEMA, TABLE_COLLATION, TABLE_COMMENT from information_schema.tables where table_schema = ? and table_type = 'BASE TABLE' order by CREATE_TIME desc`,
      bindings: [this.client.database()],
      output(resp) {
        const out = resp.reduce(function (tables, val) {
          tables[val.TABLE_NAME] = {
            engine: val.ENGINE,
            schema: val.TABLE_SCHEMA,
            collation: val.TABLE_COLLATION,
            comment: val.TABLE_COMMENT,
          };
          return tables;
        }, {});
        return out;
      },
    };
  }

  // Compiles a `columnInfo` query.
  columnInfo() {
    const column = this.single.columnInfo;

    // The user may have specified a custom wrapIdentifier function in the config. We
    // need to run the identifiers through that function, but not format them as
    // identifiers otherwise.
    const table = this.client.customWrapIdentifier(this.single.table, identity);

    return {
      sql:
        //'select * from information_schema.columns where table_name = ? and table_schema = ? order by TABLE_NAME, ORDINAL_POSITION',
        `select c.COLUMN_NAME, c.COLUMN_DEFAULT, c.DATA_TYPE, c.CHARACTER_MAXIMUM_LENGTH, c.IS_NULLABLE, c.COLUMN_KEY, c.EXTRA, c.COLLATION_NAME, c.COLLATION_NAME, c.COLUMN_COMMENT,
  fk.REFERENCED_TABLE_NAME, fk.REFERENCED_COLUMN_NAME, fk.CONSTRAINT_NAME, rc.UPDATE_RULE, rc.DELETE_RULE, rc.MATCH_OPTION
  from information_schema.columns c
left join INFORMATION_SCHEMA.KEY_COLUMN_USAGE fk on fk.TABLE_NAME = c.TABLE_NAME AND
  fk.COLUMN_NAME = c.COLUMN_NAME AND fk.CONSTRAINT_SCHEMA = c.TABLE_SCHEMA
left join INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc on rc.TABLE_NAME = fk.TABLE_NAME AND
  rc.CONSTRAINT_NAME = fk.CONSTRAINT_NAME AND rc.CONSTRAINT_SCHEMA = fk.CONSTRAINT_SCHEMA
where c.table_name = ? and c.table_schema = ? order by c.TABLE_NAME, c.ORDINAL_POSITION
`,
      bindings: [table, this.client.database()],
      output(resp) {
        const out = resp.reduce(function (columns, val) {
          columns[val.COLUMN_NAME] = {
            defaultValue: val.COLUMN_DEFAULT,
            type: val.DATA_TYPE,
            maxLength: val.CHARACTER_MAXIMUM_LENGTH,
            nullable: val.IS_NULLABLE === 'YES',
            primary: val.COLUMN_KEY === 'PRI',
            increments: val.EXTRA && val.EXTRA.indexOf('auto_increment') != -1,
            collation: val.COLLATION_NAME,
            references: val.REFERENCED_COLUMN_NAME,
            inTable: val.REFERENCED_TABLE_NAME,
            onDelete: val.DELETE_RULE,
            onUpdate: val.UPDATE_RULE,
            comment: val.COLUMN_COMMENT,
          };
          return columns;
        }, {});
        return (column && out[column]) || out;
      },
    };
  }

  limit() {
    const noLimit = !this.single.limit && this.single.limit !== 0;
    if (noLimit && !this.single.offset) return '';

    // Workaround for offset only.
    // see: http://stackoverflow.com/questions/255517/mysql-offset-infinite-rows
    const limit =
      this.single.offset && noLimit
        ? '18446744073709551615'
        : this.formatter.parameter(this.single.limit);
    return `limit ${limit}`;
  }
}

// Set the QueryBuilder & QueryCompiler on the client object,
// in case anyone wants to modify things to suit their own purposes.
module.exports = QueryCompiler_MySQL;
