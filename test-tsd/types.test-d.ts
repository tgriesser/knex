import { expectAssignable, expectType } from 'tsd';
import { clientConfig, User } from './common';

import knexDefault, { Knex, knex } from '../types';
import * as knexStar from '../types';
import knexCjsImport = require('../');
import QueryBuilder = Knex.QueryBuilder;
import KnexTimeoutError = knex.KnexTimeoutError;

const knexCjs = require('../knex');
const { knex: knexCjsNamed } = require('../knex');

expectType<Knex<any, unknown[]>>(knexDefault({}));
expectType<Knex<any, unknown[]>>(knex({}));
expectType<Knex<any, unknown[]>>(knexStar.default({}));
expectType<Knex<any, unknown[]>>(knexStar.knex({}));
expectType<Knex<any, unknown[]>>(knexCjsImport.default({}));
expectType<Knex<any, unknown[]>>(knexCjsImport.knex({}));
expectType<KnexTimeoutError>(new knex.KnexTimeoutError());
expectType<KnexTimeoutError>(new knex.KnexTimeoutError());

// eslint-disable-next-line
expectType<any>(knexCjs({}));
// eslint-disable-next-line
expectType<any>(knexCjsNamed({}));

knex({}).schema.createTable("table", (t: Knex.AlterTableBuilder) => {})

const knexInstance = knexDefault(clientConfig);

// ToDo remove this copy-pasted type after we can export it as a named properly
type DeferredKeySelection<
  // The base of selection. In intermediate stages this may be unknown.
  // If it remains unknown at the point of resolution, the selection will fall back to any
  TBase,
  // Union of keys to be selected
  // In intermediate stages this may be never.
  TKeys extends string,
  // Changes how the resolution should behave if TKeys is never.
  // If true, then we assume that some keys were selected, and if TKeys is never, we will fall back to any.
  // If false, and TKeys is never, then we select TBase in its entirety
  THasSelect extends true | false = false,
  // Mapping of aliases <key in result> -> <key in TBase>
  TAliasMapping extends {} = {},
  // If enabled, then instead of extracting a partial, during resolution
  // we will pick just a single property.
  TSingle extends boolean = false,
  // Extra props which will be intersected with the result
  TIntersectProps extends {} = {},
  // Extra props which will be unioned with the result
  TUnionProps = never
> = {
  // These properties are not actually used, but exist simply because
  // typescript doesn't end up happy when type parameters are unused
  _base: TBase;
  _hasSelection: THasSelect;
  _keys: TKeys;
  _aliases: TAliasMapping;
  _single: TSingle;
  _intersectProps: TIntersectProps;
  _unionProps: TUnionProps;
};

// # Insert onConflict
expectType<
  QueryBuilder<
    User,
    DeferredKeySelection<User, never, false, {}, false, {}, never>[]
  >
>(
  knexInstance
    .table<User>('users')
    .insert({ id: 10, active: true })
    .onConflict('id')
    .merge({ active: true })
    .returning('*')
);

expectAssignable<QueryBuilder>(
  knexInstance
    .insert({ col: 'x' })
    .into('table')
    .onConflict('col')
    .merge({ x: 'x' })
    .debug(true)
);

expectAssignable<QueryBuilder>(
  knexInstance
    .insert({ id: 10, active: true })
    .into('table')
    .onConflict(['id'])
    .merge({ x: 'x' })
    .debug(true)
);

expectType<
  QueryBuilder<
    User,
    DeferredKeySelection<User, 'id', true, {}, true, {}, never>[]
  >
>(
  knexInstance
    .table<User>('users')
    .insert({ id: 10, active: true })
    .onConflict('id')
    .ignore()
);

expectAssignable<QueryBuilder>(
  knexInstance
    .insert({ id: 10, active: true })
    .into('table')
    .onConflict(['id'])
    .merge(['active', 'id'])
    .debug(true)
);
