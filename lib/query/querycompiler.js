// Query Compiler
// -------
const helpers = require('../util/helpers');
const Raw = require('../raw');
const QueryBuilder = require('./querybuilder');
const JoinClause = require('./joinclause');
const debug = require('debug');

const assign = require('lodash/assign');
const compact = require('lodash/compact');
const groupBy = require('lodash/groupBy');
const has = require('lodash/has');
const isEmpty = require('lodash/isEmpty');
const map = require('lodash/map');
const omitBy = require('lodash/omitBy');
const reduce = require('lodash/reduce');
const { nanoid } = require('../util/nanoid');
const { isString, isUndefined } = require('../util/is');
const {
  columnize: columnize_,
  direction: direction_,
  operator: operator_,
  wrap: wrap_,
  unwrapRaw: unwrapRaw_,
  rawOrFn: rawOrFn_,
} = require('../formatter/wrappingFormatter');

const debugBindings = debug('knex:bindings');

const components = [
  'columns',
  'join',
  'where',
  'union',
  'group',
  'having',
  'order',
  'limit',
  'offset',
  'lock',
  'waitMode',
];

// The "QueryCompiler" takes all of the query statements which
// have been gathered in the "QueryBuilder" and turns them into a
// properly formatted / bound query string.
class QueryCompiler {
  constructor(client, builder, bindings) {
    this.client = client;
    this.method = builder._method || 'select';
    this.options = builder._options;
    this.single = builder._single;
    this.timeout = builder._timeout || false;
    this.cancelOnTimeout = builder._cancelOnTimeout || false;
    this.grouped = groupBy(builder._statements, 'grouping');
    this.formatter = client.formatter(builder);
    // Used when the insert call is empty.
    this._emptyInsertValue = 'default values';
    this.first = this.select;

    this.bindings = bindings || [];
    this.formatter.bindings = this.bindings;
    this.bindingsHolder = this;
    this.builder = this.formatter.builder;
  }

  // Collapse the builder into a single object
  toSQL(method, tz) {
    this._undefinedInWhereClause = false;
    this.undefinedBindingsInfo = [];

    method = method || this.method;
    const val = this[method]() || '';

    const query = {
      method,
      options: reduce(this.options, assign, {}),
      timeout: this.timeout,
      cancelOnTimeout: this.cancelOnTimeout,
      bindings: this.bindingsHolder.bindings || [],
      __knexQueryUid: nanoid(),
    };

    Object.defineProperties(query, {
      toNative: {
        value: () => {
          return {
            sql: this.client.positionBindings(query.sql),
            bindings: this.client.prepBindings(query.bindings),
          };
        },
        enumerable: false,
      },
    });

    if (isString(val)) {
      query.sql = val;
    } else {
      assign(query, val);
    }

    if (method === 'select' || method === 'first') {
      if (this.single.as) {
        query.as = this.single.as;
      }
    }

    if (this._undefinedInWhereClause) {
      debugBindings(query.bindings);
      throw new Error(
        `Undefined binding(s) detected when compiling ` +
          `${method.toUpperCase()}. Undefined column(s): [${this.undefinedBindingsInfo.join(
            ', '
          )}] query: ${query.sql}`
      );
    }

    return query;
  }

  // Compiles the `select` statement, or nested sub-selects by calling each of
  // the component compilers, trimming out the empties, and returning a
  // generated query string.
  select() {
    let sql = this.with();

    const statements = components.map((component) => this[component](this));
    sql += compact(statements).join(' ');
    return sql;
  }

  pluck() {
    let toPluck = this.single.pluck;
    if (toPluck.indexOf('.') !== -1) {
      toPluck = toPluck.split('.').slice(-1)[0];
    }
    return {
      sql: this.select(),
      pluck: toPluck,
    };
  }

  // Compiles an "insert" query, allowing for multiple
  // inserts using a single query statement.
  insert() {
    const insertValues = this.single.insert || [];
    let sql = this.with() + `insert into ${this.tableName} `;
    if (Array.isArray(insertValues)) {
      if (insertValues.length === 0) {
        return '';
      }
    } else if (typeof insertValues === 'object' && isEmpty(insertValues)) {
      return sql + this._emptyInsertValue;
    }

    const insertData = this._prepInsert(insertValues);
    if (typeof insertData === 'string') {
      sql += insertData;
    } else {
      if (insertData.columns.length) {
        sql += `(${columnize_(
          insertData.columns,
          this.builder,
          this.client,
          this.bindingsHolder
        )}`;
        sql += ') values (';
        let i = -1;
        while (++i < insertData.values.length) {
          if (i !== 0) sql += '), (';
          sql += this.client.parameterize(
            insertData.values[i],
            this.client.valueForUndefined,
            this.builder,
            this.bindingsHolder
          );
        }
        sql += ')';
      } else if (insertValues.length === 1 && insertValues[0]) {
        sql += this._emptyInsertValue;
      } else {
        sql = '';
      }
    }
    return sql;
  }

  // Compiles the "update" query.
  update() {
    // Make sure tableName is processed by the formatter first.
    const withSQL = this.with();
    const { tableName } = this;
    const updateData = this._prepUpdate(this.single.update);
    const wheres = this.where();
    return (
      withSQL +
      `update ${this.single.only ? 'only ' : ''}${tableName}` +
      ' set ' +
      updateData.join(', ') +
      (wheres ? ` ${wheres}` : '')
    );
  }

  _hintComments() {
    let hints = this.grouped.hintComments || [];
    hints = hints.map((hint) => compact(hint.value).join(' '));
    hints = compact(hints).join(' ');
    return hints ? `/*+ ${hints} */ ` : '';
  }

  // Compiles the columns in the query, specifying if an item was distinct.
  columns() {
    let distinctClause = '';
    if (this.onlyUnions()) return '';
    const hints = this._hintComments();
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
        } else if (stmt.type === 'analytic') {
          sql.push(this.analytic(stmt));
        } else if (stmt.value && stmt.value.length > 0) {
          sql.push(
            columnize_(
              stmt.value,
              this.builder,
              this.client,
              this.bindingsHolder
            )
          );
        }
      }
    }
    if (sql.length === 0) sql = ['*'];
    return (
      `select ${hints}${distinctClause}` +
      sql.join(', ') +
      (this.tableName
        ? ` from ${this.single.only ? 'only ' : ''}${this.tableName}`
        : '')
    );
  }

  _aggregate(stmt, { aliasSeparator = ' as ', distinctParentheses } = {}) {
    const value = stmt.value;
    const method = stmt.method;
    const distinct = stmt.aggregateDistinct ? 'distinct ' : '';
    const wrap = (identifier) =>
      wrap_(
        identifier,
        undefined,
        this.builder,
        this.client,
        this.bindingsHolder
      );
    const addAlias = (value, alias) => {
      if (alias) {
        return value + aliasSeparator + wrap(alias);
      }
      return value;
    };
    const aggregateArray = (value, alias) => {
      let columns = value.map(wrap).join(', ');
      if (distinct) {
        const openParen = distinctParentheses ? '(' : ' ';
        const closeParen = distinctParentheses ? ')' : '';
        columns = distinct.trim() + openParen + columns + closeParen;
      }
      const aggregated = `${method}(${columns})`;
      return addAlias(aggregated, alias);
    };
    const aggregateString = (value, alias) => {
      const aggregated = `${method}(${distinct + wrap(value)})`;
      return addAlias(aggregated, alias);
    };

    if (Array.isArray(value)) {
      return [aggregateArray(value)];
    }

    if (typeof value === 'object') {
      if (stmt.alias) {
        throw new Error('When using an object explicit alias can not be used');
      }
      return Object.entries(value).map(([alias, column]) => {
        if (Array.isArray(column)) {
          return aggregateArray(column, alias);
        }
        return aggregateString(column, alias);
      });
    }

    // Allows us to speciy an alias for the aggregate types.
    const splitOn = value.toLowerCase().indexOf(' as ');
    let column = value;
    let { alias } = stmt;
    if (splitOn !== -1) {
      column = value.slice(0, splitOn);
      if (alias) {
        throw new Error(`Found multiple aliases for same column: ${column}`);
      }
      alias = value.slice(splitOn + 4);
    }
    return [aggregateString(column, alias)];
  }

  aggregate(stmt) {
    return this._aggregate(stmt);
  }

  aggregateRaw(stmt) {
    const distinct = stmt.aggregateDistinct ? 'distinct ' : '';
    return `${stmt.method}(${
      distinct +
      unwrapRaw_(
        stmt.value,
        undefined,
        this.builder,
        this.client,
        this.bindingsHolder
      )
    })`;
  }

  // Compiles all each of the `join` clauses on the query,
  // including any nested join queries.
  join() {
    let sql = '';
    let i = -1;
    const joins = this.grouped.join;
    if (!joins) return '';
    while (++i < joins.length) {
      const join = joins[i];
      const table =
        join.schema && !(join.table instanceof Raw)
          ? `${join.schema}.${join.table}`
          : join.table;
      if (i > 0) sql += ' ';
      if (join.joinType === 'raw') {
        sql += unwrapRaw_(
          join.table,
          undefined,
          this.builder,
          this.client,
          this.bindingsHolder
        );
      } else {
        sql +=
          join.joinType +
          ' join ' +
          wrap_(
            table,
            undefined,
            this.builder,
            this.client,
            this.bindingsHolder
          );
        let ii = -1;
        while (++ii < join.clauses.length) {
          const clause = join.clauses[ii];
          if (ii > 0) {
            sql += ` ${clause.bool} `;
          } else {
            sql += ` ${clause.type === 'onUsing' ? 'using' : 'on'} `;
          }
          const val = this[clause.type](clause);
          if (val) {
            sql += val;
          }
        }
      }
    }
    return sql;
  }

  onBetween(statement) {
    return (
      wrap_(
        statement.column,
        undefined,
        this.builder,
        this.client,
        this.bindingsHolder
      ) +
      ' ' +
      this._not(statement, 'between') +
      ' ' +
      statement.value
        .map((value) =>
          this.client.parameter(value, this.builder, this.bindingsHolder)
        )
        .join(' and ')
    );
  }

  onNull(statement) {
    return (
      wrap_(
        statement.column,
        undefined,
        this.builder,
        this.client,
        this.bindingsHolder
      ) +
      ' is ' +
      this._not(statement, 'null')
    );
  }

  onExists(statement) {
    return (
      this._not(statement, 'exists') +
      ' (' +
      rawOrFn_(
        statement.value,
        undefined,
        this.builder,
        this.client,
        this.bindingsHolder
      ) +
      ')'
    );
  }

  onIn(statement) {
    if (Array.isArray(statement.column)) return this.multiOnIn(statement);
    return (
      wrap_(
        statement.column,
        undefined,
        this.builder,
        this.client,
        this.bindingsHolder
      ) +
      ' ' +
      this._not(statement, 'in ') +
      this.wrap(
        this.client.parameterize(
          statement.value,
          undefined,
          this.builder,
          this.bindingsHolder
        )
      )
    );
  }

  multiOnIn(statement) {
    let i = -1,
      sql = `(${columnize_(
        statement.column,
        this.builder,
        this.client,
        this.bindingsHolder
      )}) `;
    sql += this._not(statement, 'in ') + '((';
    while (++i < statement.value.length) {
      if (i !== 0) sql += '),(';
      sql += this.client.parameterize(
        statement.value[i],
        undefined,
        this.builder,
        this.bindingsHolder
      );
    }
    return sql + '))';
  }

  // Compiles all `where` statements on the query.
  where() {
    const wheres = this.grouped.where;
    if (!wheres) return;
    const sql = [];
    let i = -1;
    while (++i < wheres.length) {
      const stmt = wheres[i];
      if (
        Object.prototype.hasOwnProperty.call(stmt, 'value') &&
        helpers.containsUndefined(stmt.value)
      ) {
        this.undefinedBindingsInfo.push(stmt.column);
        this._undefinedInWhereClause = true;
      }
      const val = this[stmt.type](stmt);
      if (val) {
        if (sql.length === 0) {
          sql[0] = 'where';
        } else {
          sql.push(stmt.bool);
        }
        sql.push(val);
      }
    }
    return sql.length > 1 ? sql.join(' ') : '';
  }

  group() {
    return this._groupsOrders('group');
  }

  order() {
    return this._groupsOrders('order');
  }

  // Compiles the `having` statements.
  having() {
    const havings = this.grouped.having;
    if (!havings) return '';
    const sql = ['having'];
    for (let i = 0, l = havings.length; i < l; i++) {
      const s = havings[i];
      const val = this[s.type](s);
      if (val) {
        if (sql.length === 0) {
          sql[0] = 'where';
        }
        if (sql.length > 1 || (sql.length === 1 && sql[0] !== 'having')) {
          sql.push(s.bool);
        }
        sql.push(val);
      }
    }
    return sql.length > 1 ? sql.join(' ') : '';
  }

  havingRaw(statement) {
    return (
      this._not(statement, '') +
      unwrapRaw_(
        statement.value,
        undefined,
        this.builder,
        this.client,
        this.bindingsHolder
      )
    );
  }

  havingWrapped(statement) {
    const val = rawOrFn_(
      statement.value,
      'where',
      this.builder,
      this.client,
      this.bindingsHolder
    );
    return (val && this._not(statement, '') + '(' + val.slice(6) + ')') || '';
  }

  havingBasic(statement) {
    return (
      this._not(statement, '') +
      wrap_(
        statement.column,
        undefined,
        this.builder,
        this.client,
        this.bindingsHolder
      ) +
      ' ' +
      operator_(
        statement.operator,
        this.builder,
        this.client,
        this.bindingsHolder
      ) +
      ' ' +
      this.client.parameter(statement.value, this.builder, this.bindingsHolder)
    );
  }

  havingNull(statement) {
    return (
      wrap_(
        statement.column,
        undefined,
        this.builder,
        this.client,
        this.bindingsHolder
      ) +
      ' is ' +
      this._not(statement, 'null')
    );
  }

  havingExists(statement) {
    return (
      this._not(statement, 'exists') +
      ' (' +
      rawOrFn_(
        statement.value,
        undefined,
        this.builder,
        this.client,
        this.bindingsHolder
      ) +
      ')'
    );
  }

  havingBetween(statement) {
    return (
      wrap_(
        statement.column,
        undefined,
        this.builder,
        this.client,
        this.bindingsHolder
      ) +
      ' ' +
      this._not(statement, 'between') +
      ' ' +
      statement.value
        .map((value) =>
          this.client.parameter(value, this.builder, this.bindingsHolder)
        )
        .join(' and ')
    );
  }

  havingIn(statement) {
    if (Array.isArray(statement.column)) return this.multiHavingIn(statement);
    return (
      wrap_(
        statement.column,
        undefined,
        this.builder,
        this.client,
        this.bindingsHolder
      ) +
      ' ' +
      this._not(statement, 'in ') +
      this.wrap(
        this.client.parameterize(
          statement.value,
          undefined,
          this.builder,
          this.bindingsHolder
        )
      )
    );
  }

  multiHavingIn(statement) {
    let i = -1,
      sql = `(${columnize_(
        statement.column,
        this.builder,
        this.client,
        this.bindingsHolder
      )}) `;
    sql += this._not(statement, 'in ') + '((';
    while (++i < statement.value.length) {
      if (i !== 0) sql += '),(';
      sql += this.client.parameterize(
        statement.value[i],
        undefined,
        this.builder,
        this.bindingsHolder
      );
    }
    return sql + '))';
  }

  // Compile the "union" queries attached to the main query.
  union() {
    const onlyUnions = this.onlyUnions();
    const unions = this.grouped.union;
    if (!unions) return '';
    let sql = '';
    for (let i = 0, l = unions.length; i < l; i++) {
      const union = unions[i];
      if (i > 0) sql += ' ';
      if (i > 0 || !onlyUnions) sql += union.clause + ' ';
      const statement = rawOrFn_(
        union.value,
        undefined,
        this.builder,
        this.client,
        this.bindingsHolder
      );
      if (statement) {
        if (union.wrap) sql += '(';
        sql += statement;
        if (union.wrap) sql += ')';
      }
    }
    return sql;
  }

  // If we haven't specified any columns or a `tableName`, we're assuming this
  // is only being used for unions.
  onlyUnions() {
    return !this.grouped.columns && this.grouped.union && !this.tableName;
  }

  limit() {
    const noLimit = !this.single.limit && this.single.limit !== 0;
    if (noLimit) return '';
    return `limit ${this.client.parameter(
      this.single.limit,
      this.builder,
      this.bindingsHolder
    )}`;
  }

  offset() {
    if (!this.single.offset) return '';
    return `offset ${this.client.parameter(
      this.single.offset,
      this.builder,
      this.bindingsHolder
    )}`;
  }

  // Compiles a `delete` query.
  del() {
    // Make sure tableName is processed by the formatter first.
    const { tableName } = this;
    const withSQL = this.with();
    const wheres = this.where();
    const joins = this.join();
    // When using joins, delete the "from" table values as a default
    const deleteSelector = joins ? tableName + ' ' : '';
    return (
      withSQL +
      `delete ${deleteSelector}from ${
        this.single.only ? 'only ' : ''
      }${tableName}` +
      (joins ? ` ${joins}` : '') +
      (wheres ? ` ${wheres}` : '')
    );
  }

  // Compiles a `truncate` query.
  truncate() {
    return `truncate ${this.tableName}`;
  }

  // Compiles the "locks".
  lock() {
    if (this.single.lock) {
      return this[this.single.lock]();
    }
  }

  // Compiles the wait mode on the locks.
  waitMode() {
    if (this.single.waitMode) {
      return this[this.single.waitMode]();
    }
  }

  // Fail on unsupported databases
  skipLocked() {
    throw new Error(
      '.skipLocked() is currently only supported on MySQL 8.0+ and PostgreSQL 9.5+'
    );
  }

  // Fail on unsupported databases
  noWait() {
    throw new Error(
      '.noWait() is currently only supported on MySQL 8.0+, MariaDB 10.3.0+ and PostgreSQL 9.5+'
    );
  }

  distinctOn(value) {
    throw new Error('.distinctOn() is currently only supported on PostgreSQL');
  }

  // On Clause
  // ------

  onWrapped(clause) {
    const self = this;

    const wrapJoin = new JoinClause();
    clause.value.call(wrapJoin, wrapJoin);

    let sql = '';

    for (let ii = 0; ii < wrapJoin.clauses.length; ii++) {
      const wrapClause = wrapJoin.clauses[ii];
      if (ii > 0) {
        sql += ` ${wrapClause.bool} `;
      }
      const val = self[wrapClause.type](wrapClause);
      if (val) {
        sql += val;
      }
    }

    if (sql.length) {
      return `(${sql})`;
    }
    return '';
  }

  onBasic(clause) {
    return (
      wrap_(
        clause.column,
        undefined,
        this.builder,
        this.client,
        this.bindingsHolder
      ) +
      ' ' +
      operator_(
        clause.operator,
        this.builder,
        this.client,
        this.bindingsHolder
      ) +
      ' ' +
      wrap_(
        clause.value,
        undefined,
        this.builder,
        this.client,
        this.bindingsHolder
      )
    );
  }

  onVal(clause) {
    return (
      wrap_(
        clause.column,
        undefined,
        this.builder,
        this.client,
        this.bindingsHolder
      ) +
      ' ' +
      operator_(
        clause.operator,
        this.builder,
        this.client,
        this.bindingsHolder
      ) +
      ' ' +
      this.client.parameter(clause.value, this.builder, this.bindingsHolder)
    );
  }

  onRaw(clause) {
    return unwrapRaw_(
      clause.value,
      undefined,
      this.builder,
      this.client,
      this.bindingsHolder
    );
  }

  onUsing(clause) {
    return (
      '(' +
      columnize_(
        clause.column,
        this.builder,
        this.client,
        this.bindingsHolder
      ) +
      ')'
    );
  }

  // Where Clause
  // ------

  whereIn(statement) {
    let columns;
    if (Array.isArray(statement.column)) {
      columns = `(${columnize_(
        statement.column,
        this.builder,
        this.client,
        this.bindingsHolder
      )})`;
    } else {
      columns = wrap_(
        statement.column,
        undefined,
        this.builder,
        this.client,
        this.bindingsHolder
      );
    }

    const values = this.client.values(
      statement.value,
      this.builder,
      this.bindingsHolder
    );
    return `${columns} ${this._not(statement, 'in ')}${values}`;
  }

  whereLike(statement) {
    let columns;
    if (Array.isArray(statement.column)) {
      columns = `(${columnize_(
        statement.column,
        this.builder,
        this.client,
        this.bindingsHolder
      )})`;
    } else {
      columns = wrap_(
        statement.column,
        undefined,
        this.builder,
        this.client,
        this.bindingsHolder
      );
    }

    const values = this.client.values(
      statement.value,
      this.builder,
      this.bindingsHolder
    );
    return `${columns} ${this._not(statement, 'like ')}${values}`;
  }

  whereILike(statement) {
    let columns;
    if (Array.isArray(statement.column)) {
      columns = `(${columnize_(
        statement.column,
        this.builder,
        this.client,
        this.bindingsHolder
      )})`;
    } else {
      columns = wrap_(
        statement.column,
        undefined,
        this.builder,
        this.client,
        this.bindingsHolder
      );
    }

    const values = this.client.values(
      statement.value,
      this.builder,
      this.bindingsHolder
    );
    return `${columns} ${this._not(statement, 'ilike ')}${values}`;
  }

  whereNull(statement) {
    return (
      wrap_(
        statement.column,
        undefined,
        this.builder,
        this.client,
        this.bindingsHolder
      ) +
      ' is ' +
      this._not(statement, 'null')
    );
  }

  // Compiles a basic "where" clause.
  whereBasic(statement) {
    return (
      this._not(statement, '') +
      wrap_(
        statement.column,
        undefined,
        this.builder,
        this.client,
        this.bindingsHolder
      ) +
      ' ' +
      operator_(
        statement.operator,
        this.builder,
        this.client,
        this.bindingsHolder
      ) +
      ' ' +
      (statement.asColumn
        ? wrap_(
            statement.value,
            undefined,
            this.builder,
            this.client,
            this.bindingsHolder
          )
        : this.client.parameter(
            statement.value,
            this.builder,
            this.bindingsHolder
          ))
    );
  }

  whereExists(statement) {
    return (
      this._not(statement, 'exists') +
      ' (' +
      rawOrFn_(
        statement.value,
        undefined,
        this.builder,
        this.client,
        this.bindingsHolder
      ) +
      ')'
    );
  }

  whereWrapped(statement) {
    const val = rawOrFn_(
      statement.value,
      'where',
      this.builder,
      this.client,
      this.bindingsHolder
    );
    return (val && this._not(statement, '') + '(' + val.slice(6) + ')') || '';
  }

  whereBetween(statement) {
    return (
      wrap_(
        statement.column,
        undefined,
        this.builder,
        this.client,
        this.bindingsHolder
      ) +
      ' ' +
      this._not(statement, 'between') +
      ' ' +
      statement.value
        .map((value) =>
          this.client.parameter(value, this.builder, this.bindingsHolder)
        )
        .join(' and ')
    );
  }

  // Compiles a "whereRaw" query.
  whereRaw(statement) {
    return (
      this._not(statement, '') +
      unwrapRaw_(
        statement.value,
        undefined,
        this.builder,
        this.client,
        this.bindingsHolder
      )
    );
  }

  wrap(str) {
    if (str.charAt(0) !== '(') return `(${str})`;
    return str;
  }

  analytic(stmt) {
    let sql = '';
    const self = this;
    sql += stmt.method + '() over (';

    if (stmt.raw) {
      sql += stmt.raw;
    } else {
      if (stmt.partitions.length) {
        sql += 'partition by ';
        sql +=
          map(stmt.partitions, function (partition) {
            return self.formatter.columnize(partition);
          }).join(', ') + ' ';
      }

      sql += 'order by ';
      sql += map(stmt.order, function (order) {
        return self.formatter.columnize(order);
      }).join(', ');
    }

    sql += ')';

    if (stmt.alias) {
      sql += ' as ' + stmt.alias;
    }

    return sql;
  }

  // Compiles all `with` statements on the query.
  with() {
    if (!this.grouped.with || !this.grouped.with.length) {
      return '';
    }
    const withs = this.grouped.with;
    if (!withs) return;
    const sql = [];
    let i = -1;
    let isRecursive = false;
    while (++i < withs.length) {
      const stmt = withs[i];
      if (stmt.recursive) {
        isRecursive = true;
      }
      const val = this[stmt.type](stmt);
      sql.push(val);
    }
    return `with ${isRecursive ? 'recursive ' : ''}${sql.join(', ')} `;
  }

  withWrapped(statement) {
    const val = rawOrFn_(
      statement.value,
      undefined,
      this.builder,
      this.client,
      this.bindingsHolder
    );
    return (
      (val &&
        columnize_(
          statement.alias,
          this.builder,
          this.client,
          this.bindingsHolder
        ) +
          ' as (' +
          val +
          ')') ||
      ''
    );
  }

  // Determines whether to add a "not" prefix to the where clause.
  _not(statement, str) {
    if (statement.not) return `not ${str}`;
    return str;
  }

  _prepInsert(data) {
    const isRaw = rawOrFn_(
      data,
      undefined,
      this.builder,
      this.client,
      this.bindingsHolder
    );
    if (isRaw) return isRaw;
    let columns = [];
    const values = [];
    if (!Array.isArray(data)) data = data ? [data] : [];
    let i = -1;
    while (++i < data.length) {
      if (data[i] == null) break;
      if (i === 0) columns = Object.keys(data[i]).sort();
      const row = new Array(columns.length);
      const keys = Object.keys(data[i]);
      let j = -1;
      while (++j < keys.length) {
        const key = keys[j];
        let idx = columns.indexOf(key);
        if (idx === -1) {
          columns = columns.concat(key).sort();
          idx = columns.indexOf(key);
          let k = -1;
          while (++k < values.length) {
            values[k].splice(idx, 0, undefined);
          }
          row.splice(idx, 0, undefined);
        }
        row[idx] = data[i][key];
      }
      values.push(row);
    }
    return {
      columns,
      values,
    };
  }

  // "Preps" the update.
  _prepUpdate(data = {}) {
    const { counter = {} } = this.single;

    for (const column of Object.keys(counter)) {
      //Skip?
      if (has(data, column)) {
        //Needed?
        this.client.logger.warn(
          `increment/decrement called for a column that has already been specified in main .update() call. Ignoring increment/decrement and using value from .update() call.`
        );
        continue;
      }

      let value = counter[column];

      const symbol = value < 0 ? '-' : '+';

      if (symbol === '-') {
        value = -value;
      }

      data[column] = this.client.raw(`?? ${symbol} ?`, [column, value]);
    }

    data = omitBy(data, isUndefined);

    const vals = [];
    const columns = Object.keys(data);
    let i = -1;

    while (++i < columns.length) {
      vals.push(
        wrap_(
          columns[i],
          undefined,
          this.builder,
          this.client,
          this.bindingsHolder
        ) +
          ' = ' +
          this.client.parameter(
            data[columns[i]],
            this.builder,
            this.bindingsHolder
          )
      );
    }

    if (isEmpty(vals)) {
      throw new Error(
        [
          'Empty .update() call detected!',
          'Update data does not contain any values to update.',
          'This will result in a faulty query.',
          this.single.table ? `Table: ${this.single.table}.` : '',
          this.single.update
            ? `Columns: ${Object.keys(this.single.update)}.`
            : '',
        ].join(' ')
      );
    }

    return vals;
  }

  _formatGroupsItemValue(value) {
    const { formatter } = this;
    if (value instanceof Raw) {
      return unwrapRaw_(
        value,
        undefined,
        this.builder,
        this.client,
        this.bindingsHolder
      );
    } else if (value instanceof QueryBuilder) {
      return '(' + formatter.columnize(value) + ')';
    } else {
      return formatter.columnize(value);
    }
  }

  // Compiles the `order by` statements.
  _groupsOrders(type) {
    const items = this.grouped[type];
    if (!items) return '';
    const sql = items.map((item) => {
      const column = this._formatGroupsItemValue(item.value);
      const direction =
        type === 'order' && item.type !== 'orderByRaw'
          ? ` ${direction_(
              item.direction,
              this.builder,
              this.client,
              this.bindingsHolder
            )}`
          : '';
      return column + direction;
    });
    return sql.length ? type + ' by ' + sql.join(', ') : '';
  }

  // Get the table name, wrapping it if necessary.
  // Implemented as a property to prevent ordering issues as described in #704.
  get tableName() {
    if (!this._tableName) {
      // Only call this.formatter.wrap() the first time this property is accessed.
      let tableName = this.single.table;
      const schemaName = this.single.schema;

      if (tableName && schemaName) {
        const isQueryBuilder = tableName instanceof QueryBuilder;
        const isRawQuery = tableName instanceof Raw;
        const isFunction = typeof tableName === 'function';

        if (!isQueryBuilder && !isRawQuery && !isFunction) {
          tableName = `${schemaName}.${tableName}`;
        }
      }

      this._tableName = tableName
        ? // Wrap subQuery with parenthesis, #3485
          wrap_(
            tableName,
            tableName instanceof QueryBuilder,
            this.builder,
            this.client,
            this.bindingsHolder
          )
        : '';
    }
    return this._tableName;
  }
}

module.exports = QueryCompiler;
