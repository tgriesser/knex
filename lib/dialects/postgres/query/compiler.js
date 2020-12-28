// PostgreSQL Query Builder & Compiler
// ------
const QueryCompiler = require('../../../query/compiler');

const identity = require('lodash/identity');
const reduce = require('lodash/reduce');

class QueryCompiler_PG extends QueryCompiler {
  constructor(client, builder) {
    super(client, builder);
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
    let sql = QueryCompiler.prototype.insert.call(this);
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

  // Compiles an `update` query, allowing for a return value.
  del() {
    const sql = QueryCompiler.prototype.del.apply(this, arguments);
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
    if (updates) {
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
        .map((column) => this.formatter.wrapString(column.split('.').pop()))
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

  // Compiles a `listTables` query
  listTables() {
    let schema = this.single.schema;

    if (schema) {
      schema = this.client.customWrapIdentifier(schema, identity);
    }

    let sql = `select table_name, table_schema,
                 (select obj_description(oid) FROM pg_class
                  where relkind = 'r' and relname = table_name) as table_comment
               from information_schema.tables where `;
    const bindings = [];

    if (schema) {
      sql += 'table_schema = ? and ';
      bindings.push(schema);
    } else {
      sql += `table_schema = 'public' and `;
    }

    sql += `table_catalog = ? and table_type = 'BASE TABLE'`;
    bindings.push(this.client.database());

    return {
      sql: sql,
      bindings: bindings,
      output(resp) {
        const out = resp.rows.reduce(function (tables, val) {
          tables[val.table_name] = {
            schema: val.table_schema,
            comment: val.table_comment,
          };
          return tables;
        }, {});
        return out;

        //return resp.rows.map((table) => {
        //  return table.table_name;
        //});
      },
    };
  }

  // Compiles a columnInfo query
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

    let sql =
      /*
      `select *, pg_get_serial_sequence(table_name, column_name) as serial,
      (select 'YES' from pg_index i
join   pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
where  i.indrelid = table_name::regclass and a.attname = column_name
and    i.indisprimary) as primary
       from information_schema.columns where table_name = ? and table_catalog = ?`;
       */

      `select c.column_name, c.data_type, c.character_maximum_length, c.is_nullable, c.column_default,
      ( select pg_catalog.col_description(pc.oid, c.ordinal_position::int)
        from pg_catalog.pg_class pc
        where pc.oid = (select ('"' || c.table_name || '"')::regclass::oid)
            and pc.relname = c.table_name
      ) as column_comment,
      pg_get_serial_sequence(c.table_name, c.column_name) as serial,
      (select 'YES' from pg_index i
join   pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
where  i.indrelid = c.table_name::regclass and a.attname = c.column_name
and    i.indisprimary) as primary,
  ffk.referenced_table_schema, ffk.referenced_table_name, ffk.referenced_column_name
       from information_schema.columns c
left join (select k1.table_schema,
       k1.table_name,
       k1.column_name,
       k2.table_schema as referenced_table_schema,
       k2.table_name as referenced_table_name,
       k2.column_name AS referenced_column_name
from information_schema.key_column_usage k1
join information_schema.referential_constraints fk USING (constraint_schema, constraint_name)
join information_schema.key_column_usage k2
  on k2.constraint_schema = fk.unique_constraint_schema
 and k2.constraint_name = fk.unique_constraint_name
 and k2.ordinal_position = k1.position_in_unique_constraint) ffk on ffk.table_name = c.table_name and ffk.column_name = c.column_name
where c.table_name = ? and c.table_catalog = ?`;

    const bindings = [table, this.client.database()];

    if (schema) {
      sql += ' and c.table_schema = ?';
      bindings.push(schema);
    } else {
      sql += ' and c.table_schema = current_schema()';
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
              primary: val.primary === 'YES',
              increments: !!val.serial,
              references: val.referenced_column_name,
              inTable: val.referenced_table_name,
              onDelete: val.delete_rule,
              onUpdate: val.update_rule,
              comment: val.column_comment,
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
