// Originally based on contributions to DefinitelyTyped:
// Definitions by: Qubo <https://github.com/tkQubo>
//                 Pablo Rodríguez <https://github.com/MeLlamoPablo>
//                 Matt R. Wilson <https://github.com/mastermatt>
//                 Satana Charuwichitratana <https://github.com/micksatana>
//                 Shrey Jain <https://github.com/shreyjain1994>
// TypeScript Version: 3.2

/// <reference types="node" />

import tarn = require('tarn');
import events = require('events');
import stream = require('stream');
import ResultTypes = require('./result');

import { ConnectionOptions } from "tls";

// # Generic type-level utilities

// If T is object then make it a partial otherwise fallback to any
//
// This is primarily to prevent type incompatibilities where target can be unknown.
// While unknown can be assigned to any, Partial<unknown> can't be.
type SafePartial<T> = T extends {} ? Partial<T> : any;

type MaybeArray<T> = T | T[];

type StrKey<T> = string & keyof T;

// If T is unknown then convert to any, else retain original
type UnknownToAny<T> = unknown extends T ? any : T;
type AnyToUnknown<T> = unknown extends T ? unknown : T;

// Intersection conditionally applied only when TParams is non-empty
// This is primarily to keep the signatures more intuitive.
type AugmentParams<TTarget, TParams> = TParams extends {}
  ? keyof TParams extends never
    ? TTarget
    : {} & TTarget & TParams
  : TTarget;

// Check if provided keys (expressed as a single or union type) are members of TBase
type AreKeysOf<TBase, TKeys> = Boxed<TKeys> extends Boxed<keyof TBase>
  ? true
  : false;

// https://stackoverflow.com/a/50375286/476712
type UnionToIntersection<U> = (U extends any
  ? (k: U) => void
  : never) extends ((k: infer I) => void)
  ? I
  : never;

type ComparisonOperator = '=' | '>' | '>=' | '<' | '<=' | '<>';

// If T is an array, get the type of member, else fall back to never
type ArrayMember<T> = T extends (infer M)[] ? M : never;

// If T is an array, get the type of member, else retain original
type UnwrapArrayMember<T> = T extends (infer M)[] ? M : T;

// Wrap a type in a container, making it an object type.
// This is primarily useful in circumventing special handling of union/intersection in typescript
interface Boxed<T> {
  _value: T;
}

// If T can't be assigned to TBase fallback to an alternate type TAlt
type IncompatibleToAlt<T, TBase, TAlt> = T extends TBase ? T : TAlt;

type ArrayIfAlready<T1, T2> = T1 extends any[] ? T2[] : T2;

// Boxing is necessary to prevent distribution of conditional types:
// https://lorefnon.tech/2019/05/02/using-boxing-to-prevent-distribution-of-conditional-types/
type PartialOrAny<TBase, TKeys> = Boxed<TKeys> extends Boxed<never>
  ? {}
  : Boxed<TKeys> extends Boxed<keyof TBase>
  ? SafePick<TBase, TKeys & keyof TBase>
  : any;

// Retain the association of original keys with aliased keys at type level
// to facilitates type-safe aliasing for object syntax
type MappedAliasType<TBase, TAliasMapping> = {} & {
  [K in keyof TAliasMapping]: TAliasMapping[K] extends keyof TBase
    ? TBase[TAliasMapping[K]]
    : any
};

// Container type for situations when we want a partial/intersection eventually
// but the keys being selected or additional properties being augmented are not
// all known at once and we would want to effectively build up a partial/intersection
// over multiple steps.
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

// An companion namespace for DeferredKeySelection which provides type operators
// to build up participants of intersection/partial over multiple invocations
// and for final resolution.
//
// While the comments use wordings such as replacement and addition, it is important
// to keep in mind that types are always immutable and all type operators return new altered types.
declare namespace DeferredKeySelection {
  type Any = DeferredKeySelection<any, any, any, any, any, any, any>;

  // Replace the Base if already a deferred selection.
  // If not, create a new deferred selection with specified base.
  type SetBase<TSelection, TBase> = TSelection extends DeferredKeySelection<
    any,
    infer TKeys,
    infer THasSelect,
    infer TAliasMapping,
    infer TSingle,
    infer TIntersectProps,
    infer TUnionProps
  >
    ? DeferredKeySelection<TBase, TKeys, THasSelect, TAliasMapping, TSingle, TIntersectProps, TUnionProps>
    : DeferredKeySelection<TBase, never>;

  // If TSelection is already a deferred selection, then replace the base with TBase
  // If unknown, create a new deferred selection with TBase as the base
  // Else, retain original
  //
  // For practical reasons applicable to current context, we always return arrays of
  // deferred selections. So, this particular operator may not be useful in generic contexts.
  type ReplaceBase<TSelection, TBase> = UnwrapArrayMember<
    TSelection
  > extends DeferredKeySelection.Any
    ? ArrayIfAlready<TSelection, DeferredKeySelection.SetBase<UnwrapArrayMember<TSelection>, TBase>>
    : unknown extends UnwrapArrayMember<TSelection>
    ? ArrayIfAlready<TSelection, DeferredKeySelection.SetBase<unknown, TBase>>
    : TSelection;

  // Type operators to substitute individual type parameters:

  type SetSingle<
    TSelection,
    TSingle extends boolean
  > = TSelection extends DeferredKeySelection<
    infer TBase,
    infer TKeys,
    infer THasSelect,
    infer TAliasMapping,
    any,
    infer TIntersectProps,
    infer TUnionProps
  >
    ? DeferredKeySelection<TBase, TKeys, THasSelect, TAliasMapping, TSingle, TIntersectProps, TUnionProps>
    : never;

  type AddKey<
    TSelection,
    TKey extends string
  > = TSelection extends DeferredKeySelection<
    infer TBase,
    infer TKeys,
    any,
    infer TAliasMapping,
    infer TSingle,
    infer TIntersectProps,
    infer TUnionProps
  >
    ? DeferredKeySelection<TBase, TKeys | TKey, true, TAliasMapping, TSingle, TIntersectProps, TUnionProps>
    : DeferredKeySelection<unknown, TKey, true>;

  type AddAliases<TSelection, T> = TSelection extends DeferredKeySelection<
    infer TBase,
    infer TKeys,
    infer THasSelect,
    infer TAliasMapping,
    infer TSingle,
    infer TIntersectProps,
    infer TUnionProps
  >
    ? DeferredKeySelection<TBase, TKeys, THasSelect, TAliasMapping & T, TSingle, TIntersectProps, TUnionProps>
    : DeferredKeySelection<unknown, never, false, T>;

  type AddUnionMember<TSelection, T> = TSelection extends DeferredKeySelection<
    infer TBase,
    infer TKeys,
    infer THasSelect,
    infer TAliasMapping,
    infer TSingle,
    infer TIntersectProps,
    infer TUnionProps
  >
    ? DeferredKeySelection<TBase, TKeys, THasSelect, TAliasMapping, TSingle, TIntersectProps, TUnionProps | T>
    : DeferredKeySelection<TSelection, never, false, {}, false, {}, T>;

  // Convenience utility to set base, keys and aliases in a single type
  // application
  type Augment<T, TBase, TKey extends string, TAliasMapping = {}> = AddAliases<
    AddKey<SetBase<T, TBase>, TKey>,
    TAliasMapping
  >;

  // Core resolution logic -- Refer to docs for DeferredKeySelection for specifics
  type ResolveOne<TSelection> = TSelection extends DeferredKeySelection<
    infer TBase,
    infer TKeys,
    infer THasSelect,
    infer TAliasMapping,
    infer TSingle,
    infer TIntersectProps,
    infer TUnionProps
  >
    ? UnknownToAny<
      // ^ We convert final result to any if it is unknown for backward compatibility.
      //   Historically knex typings have been liberal with returning any and changing
      //   default return type to unknown would be a major breaking change for users.
      //
      //   So we compromise on type safety here and return any.
        AugmentParams<
          AnyToUnknown<TBase> extends {}
            // ^ Conversion of any -> unknown is needed here to prevent distribution
            //   of any over the conditional
            ? TSingle extends true
              ? TKeys extends keyof TBase
                ? TBase[TKeys]
                : any
              : AugmentParams<
                  true extends THasSelect ? PartialOrAny<TBase, TKeys> : TBase,
                  MappedAliasType<TBase, TAliasMapping>
                >
          : unknown,
          TIntersectProps
        > | TUnionProps
      >
    : TSelection;

  type Resolve<TSelection> = TSelection extends DeferredKeySelection.Any
      ? ResolveOne<TSelection>
      : TSelection extends DeferredKeySelection.Any[]
      ? ResolveOne<TSelection[0]>[]
      : TSelection extends (infer I)[]
      ? UnknownToAny<I>[]
      : UnknownToAny<TSelection>;
}

type AggregationQueryResult<TResult, TIntersectProps2> = ArrayIfAlready<
    TResult,
    UnwrapArrayMember<TResult> extends DeferredKeySelection<
      infer TBase,
      infer TKeys,
      infer THasSelect,
      infer TAliasMapping,
      infer TSingle,
      infer TIntersectProps,
      infer TUnionProps
    >
      ? true extends THasSelect
        ? DeferredKeySelection<TBase, TKeys, THasSelect, TAliasMapping, TSingle, TIntersectProps & TIntersectProps2, TUnionProps>
        : DeferredKeySelection<{}, never, true, {}, false, TIntersectProps2>
      : TIntersectProps2
>;

// Convenience alias and associated companion namespace for working
// with DeferredSelection having TSingle=true.
//
// When TSingle=true in DeferredSelection, then we are effectively
// deferring an index access operation (TBase[TKey]) over a potentially
// unknown initial type of TBase and potentially never initial type of TKey

type DeferredIndex<TBase, TKey extends string> = DeferredKeySelection<TBase, TKey, false, {}, true>;

declare namespace DeferredIndex {
  type Augment<
    T,
    TBase,
    TKey extends string,
    TAliasMapping = {}
  > = DeferredKeySelection.SetSingle<
    DeferredKeySelection.AddKey<DeferredKeySelection.SetBase<T, TBase>, TKey>,
    true
  >;
}

// If we have more categories of deferred selection in future,
// this will combine all of them
type ResolveResult<S> = DeferredKeySelection.Resolve<S>;

// # Type-aliases for common type combinations

type Callback = Function;
type Client = Function;

type Dict<T = any> = { [k: string]: T; };

type SafePick<T, K extends keyof T> = T extends {} ? Pick<T, K> : any;

type TableOptions = PgTableOptions;

interface PgTableOptions {
  only?: boolean;
}

interface Knex<TRecord extends {} = any, TResult = any[]>
  extends Knex.QueryInterface<TRecord, TResult>, events.EventEmitter {
  <TRecord2 = TRecord, TResult2 = DeferredKeySelection<TRecord2, never>[]>(
    tableName?: Knex.TableDescriptor | Knex.AliasDict,
    options?: TableOptions
  ): Knex.QueryBuilder<TRecord2, TResult2>;
  VERSION: string;
  __knex__: string;

  raw: Knex.RawBuilder<TRecord>;

  transactionProvider(
    config?: any
  ): () => Promise<Knex.Transaction>;
  transaction(
    transactionScope?: null,
    config?: any
  ): Promise<Knex.Transaction>;
  transaction<T>(
    transactionScope: (trx: Knex.Transaction) => Promise<T> | Promise<T> | void,
    config?: any
  ): Promise<T>;
  initialize(config?: Knex.Config): void;
  destroy(callback: Function): void;
  destroy(): Promise<void>;
  batchInsert(
    tableName: Knex.TableDescriptor,
    data: any[],
    chunkSize?: number
  ): Knex.QueryBuilder<TRecord, {}>;
  schema: Knex.SchemaBuilder;
  queryBuilder<TRecord2 = TRecord, TResult2 = TResult>(): Knex.QueryBuilder<
    TRecord2,
    TResult2
  >;

  client: any;
  migrate: Knex.Migrator;
  seed: Knex.Seeder;
  fn: Knex.FunctionHelper;
  ref: Knex.RefBuilder;
}

declare function Knex<TRecord = any, TResult = unknown[]>(
  config: Knex.Config | string
): Knex<TRecord, TResult>;

declare namespace Knex {
  //
  // Utility Types
  //

  type Value =
    | string
    | number
    | boolean
    | Date
    | Array<string>
    | Array<number>
    | Array<Date>
    | Array<boolean>
    | Buffer
    | Knex.Raw;

  interface ValueDict extends Dict<Value | Knex.QueryBuilder> {}
  interface AliasDict extends Dict<string> {}

  type ColumnDescriptor<TRecord, TResult> =
    | string
    | Knex.Raw
    | Knex.QueryBuilder<TRecord, TResult>
    | Dict<string>;

  type InferrableColumnDescriptor<TRecord extends {}> =
    | keyof TRecord
    | Knex.Ref<any, any>
    | Dict<keyof TRecord>;

  type TableDescriptor = string | Knex.Raw | Knex.QueryBuilder;

  type Lookup<TRegistry extends {}, TKey extends string, TDefault = never> =
    TKey extends keyof TRegistry ?
      TRegistry[TKey] :
      TDefault;

  //
  // QueryInterface
  //

  interface QueryInterface<TRecord extends {} = any, TResult = any> {
    select: Select<TRecord, TResult>;
    as: As<TRecord, TResult>;
    columns: Select<TRecord, TResult>;
    column: Select<TRecord, TResult>;
    from: Table<TRecord, TResult>;
    into: Table<TRecord, TResult>;
    table: Table<TRecord, TResult>;
    distinct: Distinct<TRecord, TResult>;

    // Joins
    join: Join<TRecord, TResult>;
    joinRaw: JoinRaw<TRecord, TResult>;
    innerJoin: Join<TRecord, TResult>;
    leftJoin: Join<TRecord, TResult>;
    leftOuterJoin: Join<TRecord, TResult>;
    rightJoin: Join<TRecord, TResult>;
    rightOuterJoin: Join<TRecord, TResult>;
    outerJoin: Join<TRecord, TResult>;
    fullOuterJoin: Join<TRecord, TResult>;
    crossJoin: Join<TRecord, TResult>;

    // Withs
    with: With<TRecord, TResult>;
    withRecursive: With<TRecord, TResult>;
    withRaw: WithRaw<TRecord, TResult>;
    withSchema: WithSchema<TRecord, TResult>;
    withWrapped: WithWrapped<TRecord, TResult>;

    // Wheres
    where: Where<TRecord, TResult>;
    andWhere: Where<TRecord, TResult>;
    orWhere: Where<TRecord, TResult>;
    whereNot: Where<TRecord, TResult>;
    andWhereNot: Where<TRecord, TResult>;
    orWhereNot: Where<TRecord, TResult>;
    whereRaw: WhereRaw<TRecord, TResult>;
    orWhereRaw: WhereRaw<TRecord, TResult>;
    andWhereRaw: WhereRaw<TRecord, TResult>;
    whereWrapped: WhereWrapped<TRecord, TResult>;
    havingWrapped: WhereWrapped<TRecord, TResult>;
    whereExists: WhereExists<TRecord, TResult>;
    orWhereExists: WhereExists<TRecord, TResult>;
    whereNotExists: WhereExists<TRecord, TResult>;
    orWhereNotExists: WhereExists<TRecord, TResult>;
    whereIn: WhereIn<TRecord, TResult>;
    orWhereIn: WhereIn<TRecord, TResult>;
    whereNotIn: WhereIn<TRecord, TResult>;
    orWhereNotIn: WhereIn<TRecord, TResult>;
    whereNull: WhereNull<TRecord, TResult>;
    orWhereNull: WhereNull<TRecord, TResult>;
    whereNotNull: WhereNull<TRecord, TResult>;
    orWhereNotNull: WhereNull<TRecord, TResult>;
    whereBetween: WhereBetween<TRecord, TResult>;
    orWhereBetween: WhereBetween<TRecord, TResult>;
    andWhereBetween: WhereBetween<TRecord, TResult>;
    whereNotBetween: WhereBetween<TRecord, TResult>;
    orWhereNotBetween: WhereBetween<TRecord, TResult>;
    andWhereNotBetween: WhereBetween<TRecord, TResult>;

    // Group by
    groupBy: GroupBy<TRecord, TResult>;
    groupByRaw: RawQueryBuilder<TRecord, TResult>;

    // Order by
    orderBy: OrderBy<TRecord, TResult>;
    orderByRaw: RawQueryBuilder<TRecord, TResult>;

    // Intersect
    intersect: Intersect<TRecord, TResult>;

    // Union
    union: Union<TRecord, TResult>;
    unionAll: Union<TRecord, TResult>;

    // Having
    having: Having<TRecord, TResult>;
    andHaving: Having<TRecord, TResult>;
    havingRaw: RawQueryBuilder<TRecord, TResult>;
    orHaving: Having<TRecord, TResult>;
    orHavingRaw: RawQueryBuilder<TRecord, TResult>;
    havingIn: HavingRange<TRecord, TResult>;
    orHavingNotBetween: HavingRange<TRecord, TResult>;
    havingNotBetween: HavingRange<TRecord, TResult>;
    orHavingBetween: HavingRange<TRecord, TResult>;
    havingBetween: HavingRange<TRecord, TResult>;

    // Clear
    clearSelect(): QueryBuilder<
      TRecord,
      UnwrapArrayMember<TResult> extends DeferredKeySelection<
        infer TBase,
        infer TKeys,
        true,
        any,
        any,
        any,
        any
      >
        ? DeferredKeySelection<TBase, never>[]
        : TResult
    >;
    clearWhere(): QueryBuilder<TRecord, TResult>;
    clearOrder(): QueryBuilder<TRecord, TResult>;
    clearHaving(): QueryBuilder<TRecord, TResult>;
    clearCounters(): QueryBuilder<TRecord, TResult>;

    // Paging
    offset(offset: number): QueryBuilder<TRecord, TResult>;
    limit(limit: number): QueryBuilder<TRecord, TResult>;

    // Aggregation
    count: AsymmetricAggregation<TRecord, TResult, Lookup<ResultTypes.Registry, "Count", number | string>>;
    countDistinct: AsymmetricAggregation<TRecord, TResult, Lookup<ResultTypes.Registry, "Count", number | string>>;
    min: TypePreservingAggregation<TRecord, TResult>;
    max: TypePreservingAggregation<TRecord, TResult>;
    sum: TypePreservingAggregation<TRecord, TResult>;
    sumDistinct: TypePreservingAggregation<TRecord, TResult>;
    avg: TypePreservingAggregation<TRecord, TResult>;
    avgDistinct: TypePreservingAggregation<TRecord, TResult>;

    increment(
      columnName: keyof TRecord,
      amount?: number
    ): QueryBuilder<TRecord, number>;
    increment(
      columnName: string,
      amount?: number
    ): QueryBuilder<TRecord, number>;

    decrement(
      columnName: keyof TRecord,
      amount?: number
    ): QueryBuilder<TRecord, number>;
    decrement(
      columnName: string,
      amount?: number
    ): QueryBuilder<TRecord, number>;

    // Others
    first: Select<TRecord, DeferredKeySelection.AddUnionMember<UnwrapArrayMember<TResult>, undefined>>;

    pluck<K extends keyof TRecord>(
      column: K
    ): QueryBuilder<TRecord, TRecord[K][]>;
    pluck<TResult2 extends {}>(column: string): QueryBuilder<TRecord, TResult2>;

    insert(
      data: MaybeArray<SafePartial<TRecord>>,
      returning: '*'
    ): QueryBuilder<TRecord, DeferredKeySelection<TRecord, never>[]>;
    insert<
      TKey extends StrKey<TRecord>,
      TResult2 = DeferredIndex.Augment<
        UnwrapArrayMember<TResult>,
        TRecord,
        TKey
      >[]
    >(
      data: MaybeArray<SafePartial<TRecord>>,
      returning: TKey
    ): QueryBuilder<TRecord, TResult2>;
    insert<
      TKey extends StrKey<TRecord>,
      TResult2 = DeferredKeySelection.Augment<
        UnwrapArrayMember<TResult>,
        TRecord,
        TKey
      >[]
    >(
      data: MaybeArray<SafePartial<TRecord>>,
      returning: TKey[]
    ): QueryBuilder<TRecord, TResult2>;
    insert<
      TKey extends string,
      TResult2 = DeferredIndex.Augment<
        UnwrapArrayMember<TResult>,
        TRecord,
        TKey
      >[]
    >(
      data: MaybeArray<SafePartial<TRecord>>,
      returning: TKey
    ): QueryBuilder<TRecord, TResult2>;
    insert<
      TKey extends string,
      TResult2 = DeferredIndex.Augment<
        UnwrapArrayMember<TResult>,
        TRecord,
        TKey
      >[]
    >(
      data: MaybeArray<SafePartial<TRecord>>,
      returning: TKey[]
    ): QueryBuilder<TRecord, TResult2>;
    insert<TResult2 = number[]>(
      data: MaybeArray<SafePartial<TRecord>>
    ): QueryBuilder<TRecord, TResult2>;

    modify<TRecord2 extends {} = any, TResult2 extends {} = any>(
      callback: QueryCallbackWithArgs<TRecord, any>,
      ...args: any[]
    ): QueryBuilder<TRecord2, TResult2>;

    update(
      data: MaybeArray<SafePartial<TRecord>>,
      returning: '*'
    ): QueryBuilder<TRecord, DeferredKeySelection<TRecord, never>[]>;
    update<
      TKey extends StrKey<TRecord>,
      TResult2 = DeferredIndex.Augment<
        UnwrapArrayMember<TResult>,
        TRecord,
        TKey
      >[]
    >(
      data: MaybeArray<SafePartial<TRecord>>,
      returning: TKey
    ): QueryBuilder<TRecord, TResult2>;
    update<
      TKey extends StrKey<TRecord>,
      TResult2 = DeferredKeySelection.Augment<
        UnwrapArrayMember<TResult>,
        TRecord,
        TKey
      >[]
    >(
      data: MaybeArray<SafePartial<TRecord>>,
      returning: TKey[]
    ): QueryBuilder<TRecord, TResult2>;
    update<
      TKey extends string = string,
      TResult2 extends {}[] = DeferredKeySelection.Augment<
        UnwrapArrayMember<TResult>,
        TRecord,
        TKey
      >[]
    >(
      data: MaybeArray<SafePartial<TRecord>>,
      returning: TKey | TKey[]
    ): QueryBuilder<TRecord, TResult2>;
    update<
      TKey extends string,
      TResult2 extends {}[] = DeferredKeySelection.Augment<
        UnwrapArrayMember<TResult>,
        TRecord,
        TKey
      >[]
    >(
      data: MaybeArray<SafePartial<TRecord>>,
      returning: TKey[]
    ): QueryBuilder<TRecord, TResult2>;
    update<TResult2 = number>(
      data: MaybeArray<SafePartial<TRecord>>
    ): QueryBuilder<TRecord, TResult2>;
    update<
      K1 extends StrKey<TRecord>,
      K2 extends StrKey<TRecord>,
      TResult2 = DeferredIndex.Augment<
        UnwrapArrayMember<TResult>,
        TRecord,
        K2
      >[]
    >(
      columnName: K1,
      value: TRecord[K1],
      returning: K1
    ): QueryBuilder<TRecord, TResult2>;
    update<
      K1 extends StrKey<TRecord>,
      K2 extends StrKey<TRecord>,
      TResult2 = DeferredKeySelection.Augment<
        UnwrapArrayMember<TResult>,
        TRecord,
        K2
      >[]
    >(
      columnName: K1,
      value: TRecord[K1],
      returning: K1[]
    ): QueryBuilder<TRecord, TResult2>;
    update<K extends keyof TRecord>(
      columnName: K,
      value: TRecord[K]
    ): QueryBuilder<TRecord, number>;
    update<TResult2 = SafePartial<TRecord>[]>(
      columnName: string,
      value: Value,
      returning: string | string[]
    ): QueryBuilder<TRecord, TResult2>;
    update<TResult2 = number>(columnName: string, value: Value): QueryBuilder<TRecord, TResult2>;

    returning(column: '*'): QueryBuilder<TRecord, DeferredKeySelection<TRecord, never>[]>;
    returning<
      TKey extends StrKey<TRecord>,
      TResult2 = DeferredIndex.Augment<
        UnwrapArrayMember<TResult>,
        TRecord,
        TKey
      >[]
    >(
      column: TKey
    ): QueryBuilder<TRecord, TResult2>;
    returning<
      TKey extends StrKey<TRecord>,
      TResult2 = DeferredKeySelection.SetSingle<
        DeferredKeySelection.Augment<UnwrapArrayMember<TResult>, TRecord, TKey>,
        false
      >[]
    >(
      columns: TKey[]
    ): QueryBuilder<TRecord, TResult2>;
    returning<TResult2 = SafePartial<TRecord>[]>(
      column: string | string[]
    ): QueryBuilder<TRecord, TResult2>;

    del(
      returning: '*'
    ): QueryBuilder<TRecord, DeferredKeySelection<TRecord, never>[]>;
    del<
      TKey extends StrKey<TRecord>,
      TResult2 = DeferredIndex.Augment<
        UnwrapArrayMember<TResult>,
        TRecord,
        TKey
      >[]
    >(
      returning: TKey
    ): QueryBuilder<TRecord, TResult2>;
    del<
      TKey extends StrKey<TRecord>,
      TResult2 = DeferredKeySelection.Augment<
        UnwrapArrayMember<TResult>,
        TRecord,
        TKey
      >[]
    >(
      returning: TKey[]
    ): QueryBuilder<TRecord, TResult2[]>;
    del<TResult2 = SafePartial<TRecord>[]>(
      returning: string | string[]
    ): QueryBuilder<TRecord, TResult2>;
    del<TResult2 = number>(): QueryBuilder<TRecord, TResult2>;

    delete(
      returning: '*'
    ): QueryBuilder<TRecord, DeferredKeySelection<TRecord, never>[]>;
    delete<
      TKey extends StrKey<TRecord>,
      TResult2 = DeferredIndex.Augment<
        UnwrapArrayMember<TResult>,
        TRecord,
        TKey
      >[]
    >(
      returning: TKey
    ): QueryBuilder<TRecord, TResult2>;
    delete<
      TKey extends StrKey<TRecord>,
      TResult2 = DeferredKeySelection.Augment<
        UnwrapArrayMember<TResult>,
        TRecord,
        TKey
      >[]
    >(
      returning: TKey[]
    ): QueryBuilder<TRecord, TResult2>;
    delete<TResult2 = any>(
      returning: string | string[]
    ): QueryBuilder<TRecord, TResult2>;
    delete<TResult2 = number>(): QueryBuilder<TRecord, TResult2>;

    truncate(): QueryBuilder<TRecord, void>;
  }

  interface As<TRecord, TResult> {
    (columnName: keyof TRecord): QueryBuilder<TRecord, TResult>;
    (columnName: string): QueryBuilder<TRecord, TResult>;
  }

  type IntersectAliases<AliasUT> =
     UnionToIntersection<
       IncompatibleToAlt<
         AliasUT extends (infer I)[]
           ? I extends Ref<any, infer TMapping>
             ? TMapping
             : I
           : never,
         Dict,
         {}
       >
      >;

  interface AliasQueryBuilder<TRecord extends {} = any, TResult = unknown[]> {
    <
      AliasUT extends InferrableColumnDescriptor<TRecord>[],
      TResult2 = ArrayIfAlready<TResult, DeferredKeySelection.Augment<
        UnwrapArrayMember<TResult>,
        TRecord,
        IncompatibleToAlt<ArrayMember<AliasUT>, string, never>,
        IntersectAliases<AliasUT>
      >>
    >(
      ...aliases: AliasUT
    ): QueryBuilder<TRecord, TResult2>;

    <
      AliasUT extends InferrableColumnDescriptor<TRecord>[],
      TResult2 = ArrayIfAlready<TResult, DeferredKeySelection.Augment<
        UnwrapArrayMember<TResult>,
        TRecord,
        IncompatibleToAlt<ArrayMember<AliasUT>, string, never>,
        IntersectAliases<AliasUT>
      >>
    >(
      aliases: AliasUT
    ): QueryBuilder<TRecord, TResult2>;

    <
      AliasUT extends (Dict | string)[],
      TResult2 = ArrayIfAlready<TResult, DeferredKeySelection.Augment<
        UnwrapArrayMember<TResult>,
        TRecord,
        IncompatibleToAlt<ArrayMember<AliasUT>, string, never>,
        IntersectAliases<AliasUT>
      >>
    >(
      ...aliases: AliasUT
    ): QueryBuilder<TRecord, TResult2>;

    <
      AliasUT extends (Dict | string)[],
      TResult2 = ArrayIfAlready<TResult, DeferredKeySelection.Augment<
        UnwrapArrayMember<TResult>,
        TRecord,
        IncompatibleToAlt<ArrayMember<AliasUT>, string, never>,
        IntersectAliases<AliasUT>
      >>
    >(
      aliases: AliasUT
    ): QueryBuilder<TRecord, TResult2>;
  }

  interface Select<TRecord extends {} = any, TResult = unknown[]>
    extends AliasQueryBuilder<TRecord, TResult>,
      ColumnNameQueryBuilder<TRecord, TResult> {
    (): QueryBuilder<TRecord, TResult>;

    <TResult2 = ArrayIfAlready<TResult, any>, TInnerRecord = any, TInnerResult = any>(
      ...subQueryBuilders: QueryBuilder<TInnerRecord, TInnerResult>[]
    ): QueryBuilder<TRecord, TResult2>;

    <TResult2 = ArrayIfAlready<TResult, any>, TInnerRecord = any, TInnerResult = any>(
      subQueryBuilders: QueryBuilder<TInnerRecord, TInnerResult>[]
    ): QueryBuilder<TRecord, TResult2>;
  }

  interface Table<TRecord extends {} = any, TResult extends {} = any> {
    <
      TRecord2 = unknown,
      TResult2 = DeferredKeySelection.ReplaceBase<TResult, TRecord2>
    >(
      tableName: TableDescriptor | AliasDict,
      options?: TableOptions
    ): QueryBuilder<TRecord2, TResult2>;
    <
      TRecord2 = unknown,
      TResult2 = DeferredKeySelection.ReplaceBase<TResult, TRecord2>
    >(
      callback: Function,
      options?: TableOptions
    ): QueryBuilder<TRecord2, TResult2>;
    <
      TRecord2 = unknown,
      TResult2 = DeferredKeySelection.ReplaceBase<TResult, TRecord2>
    >(
      raw: Raw,
      options?: TableOptions
    ): QueryBuilder<TRecord2, TResult2>;
  }

  interface Distinct<TRecord extends {}, TResult = {}[]>
    extends ColumnNameQueryBuilder<TRecord, TResult> {}

  interface JoinCallback {
    (this: JoinClause, join: JoinClause): void;
  }

  interface Join<TRecord extends {} = any, TResult = unknown[]> {
    <
      TJoinTargetRecord extends {} = any,
      TRecord2 extends {} = TRecord & TJoinTargetRecord,
      TResult2 = DeferredKeySelection.ReplaceBase<TResult, TRecord2>
    >(
      raw: Raw
    ): QueryBuilder<TRecord2, TResult2>;
    <
      TJoinTargetRecord extends {} = any,
      TRecord2 extends {} = TRecord & TJoinTargetRecord,
      TResult2 = DeferredKeySelection.ReplaceBase<TResult, TRecord2>
    >(
      tableName: TableDescriptor | AliasDict | QueryCallback,
      clause: JoinCallback
    ): QueryBuilder<TRecord2, TResult2>;
    <
      TJoinTargetRecord extends {} = any,
      TRecord2 extends {} = TRecord & TJoinTargetRecord,
      TResult2 = DeferredKeySelection.ReplaceBase<TResult, TRecord2>
    >(
      tableName: TableDescriptor | AliasDict | QueryCallback,
      columns: { [key: string]: string | number | boolean | Raw }
    ): QueryBuilder<TRecord2, TResult2>;
    <
      TJoinTargetRecord extends {} = any,
      TRecord2 extends {} = TRecord & TJoinTargetRecord,
      TResult2 = DeferredKeySelection.ReplaceBase<TResult, TRecord2>
    >(
      tableName: TableDescriptor | AliasDict | QueryCallback,
      raw: Raw
    ): QueryBuilder<TRecord2, TResult2>;
    <
      TJoinTargetRecord extends {} = any,
      TRecord2 extends {} = TRecord & TJoinTargetRecord,
      TResult2 = DeferredKeySelection.ReplaceBase<TResult, TRecord2>
    >(
      tableName: TableDescriptor | AliasDict | QueryCallback,
      column1: string,
      column2: string
    ): QueryBuilder<TRecord2, TResult2>;
    <
      TJoinTargetRecord extends {} = any,
      TRecord2 extends {} = TRecord & TJoinTargetRecord,
      TResult2 = DeferredKeySelection.ReplaceBase<TResult, TRecord2>
    >(
      tableName: TableDescriptor | AliasDict | QueryCallback,
      column1: string,
      raw: Raw
    ): QueryBuilder<TRecord2, TResult2>;
    <
      TJoinTargetRecord extends {} = any,
      TRecord2 extends {} = TRecord & TJoinTargetRecord,
      TResult2 = DeferredKeySelection.ReplaceBase<TResult, TRecord2>
    >(
      tableName: TableDescriptor | AliasDict | QueryCallback,
      column1: string,
      operator: string,
      column2: string
    ): QueryBuilder<TRecord2, TResult2>;
  }

  interface JoinClause {
    on(raw: Raw): JoinClause;
    on(callback: JoinCallback): JoinClause;
    on(columns: { [key: string]: string | Raw }): JoinClause;
    on(column1: string, column2: string): JoinClause;
    on(column1: string, raw: Raw): JoinClause;
    on(column1: string, operator: string, column2: string | Raw): JoinClause;
    andOn(raw: Raw): JoinClause;
    andOn(callback: JoinCallback): JoinClause;
    andOn(columns: { [key: string]: string | Raw }): JoinClause;
    andOn(column1: string, column2: string): JoinClause;
    andOn(column1: string, raw: Raw): JoinClause;
    andOn(column1: string, operator: string, column2: string | Raw): JoinClause;
    orOn(raw: Raw): JoinClause;
    orOn(callback: JoinCallback): JoinClause;
    orOn(columns: { [key: string]: string | Raw }): JoinClause;
    orOn(column1: string, column2: string): JoinClause;
    orOn(column1: string, raw: Raw): JoinClause;
    orOn(column1: string, operator: string, column2: string | Raw): JoinClause;
    onIn(column1: string, values: any[]): JoinClause;
    andOnIn(column1: string, values: any[]): JoinClause;
    orOnIn(column1: string, values: any[]): JoinClause;
    onNotIn(column1: string, values: any[]): JoinClause;
    andOnNotIn(column1: string, values: any[]): JoinClause;
    orOnNotIn(column1: string, values: any[]): JoinClause;
    onNull(column1: string): JoinClause;
    andOnNull(column1: string): JoinClause;
    orOnNull(column1: string): JoinClause;
    onNotNull(column1: string): JoinClause;
    andOnNotNull(column1: string): JoinClause;
    orOnNotNull(column1: string): JoinClause;
    onExists(callback: QueryCallback): JoinClause;
    andOnExists(callback: QueryCallback): JoinClause;
    orOnExists(callback: QueryCallback): JoinClause;
    onNotExists(callback: QueryCallback): JoinClause;
    andOnNotExists(callback: QueryCallback): JoinClause;
    orOnNotExists(callback: QueryCallback): JoinClause;
    onBetween(column1: string, range: [any, any]): JoinClause;
    andOnBetween(column1: string, range: [any, any]): JoinClause;
    orOnBetween(column1: string, range: [any, any]): JoinClause;
    onNotBetween(column1: string, range: [any, any]): JoinClause;
    andOnNotBetween(column1: string, range: [any, any]): JoinClause;
    orOnNotBetween(column1: string, range: [any, any]): JoinClause;
    using(
      column: string | string[] | Raw | { [key: string]: string | Raw }
    ): JoinClause;
    type(type: string): JoinClause;
  }

  interface JoinRaw<TRecord = any, TResult = unknown[]> {
    (tableName: string, binding?: Value | ValueDict): QueryBuilder<
      TRecord,
      TResult
    >;
  }

  interface With<TRecord = any, TResult = unknown[]>
    extends WithRaw<TRecord, TResult>,
      WithWrapped<TRecord, TResult> {}

  interface WithRaw<TRecord = any, TResult = unknown[]> {
    (alias: string, raw: Raw | QueryBuilder): QueryBuilder<TRecord, TResult>;
    (alias: string, sql: string, bindings?: Value[] | Object): QueryBuilder<
      TRecord,
      TResult
    >;
  }

  interface WithSchema<TRecord = any, TResult = unknown[]> {
    (schema: string): QueryBuilder<TRecord, TResult>;
  }

  interface WithWrapped<TRecord = any, TResult = unknown[]> {
    (alias: string, queryBuilder: QueryBuilder): QueryBuilder<TRecord, TResult>;
    (
      alias: string,
      callback: (queryBuilder: QueryBuilder) => any
    ): QueryBuilder<TRecord, TResult>;
  }

  interface Where<TRecord = any, TResult = unknown>
    extends WhereRaw<TRecord, TResult>,
      WhereWrapped<TRecord, TResult>,
      WhereNull<TRecord, TResult> {
    (raw: Raw): QueryBuilder<TRecord, TResult>;
    (callback: QueryCallback): QueryBuilder<TRecord, TResult>;

    (object: SafePartial<TRecord>): QueryBuilder<TRecord, TResult>;
    (object: Object): QueryBuilder<TRecord, TResult>;

    <T extends keyof TRecord>(
      columnName: T,
      value: TRecord[T] | null
    ): QueryBuilder<TRecord, TResult>;
    (columnName: string, value: Value | null): QueryBuilder<TRecord, TResult>;

    <T extends keyof TRecord>(
      columnName: T,
      operator: ComparisonOperator,
      value: TRecord[T] | null
    ): QueryBuilder<TRecord, TResult>;
    (columnName: string, operator: string, value: Value | null): QueryBuilder<
      TRecord,
      TResult
    >;

    <T extends keyof TRecord, TRecordInner, TResultInner>(
      columnName: T,
      operator: ComparisonOperator,
      value: QueryBuilder<TRecordInner, TResultInner>
    ): QueryBuilder<TRecord, TResult>;
    <TRecordInner, TResultInner>(
      columnName: string,
      operator: string,
      value: QueryBuilder<TRecordInner, TResultInner>
    ): QueryBuilder<TRecord, TResult>;

    (left: Raw, operator: string, right: Value | null): QueryBuilder<
      TRecord,
      TResult
    >;
    <TRecordInner, TResultInner>(
      left: Raw,
      operator: string,
      right: QueryBuilder<TRecordInner, TResultInner>
    ): QueryBuilder<TRecord, TResult>;
  }

  interface WhereRaw<TRecord = any, TResult = unknown[]>
    extends RawQueryBuilder<TRecord, TResult> {
    (condition: boolean): QueryBuilder<TRecord, TResult>;
  }

  interface WhereWrapped<TRecord = any, TResult = unknown[]> {
    (callback: QueryCallback): QueryBuilder<TRecord, TResult>;
  }

  interface WhereNull<TRecord = any, TResult = unknown[]> {
    (columnName: keyof TRecord): QueryBuilder<TRecord, TResult>;
    (columnName: string): QueryBuilder<TRecord, TResult>;
  }

  interface WhereBetween<TRecord = any, TResult = unknown[]> {
    <K extends keyof TRecord>(
      columnName: K,
      range: [TRecord[K], TRecord[K]]
    ): QueryBuilder<TRecord, TResult>;
    (columnName: string, range: [Value, Value]): QueryBuilder<TRecord, TResult>;
  }

  interface WhereExists<TRecord = any, TResult = unknown[]> {
    (callback: QueryCallback): QueryBuilder<TRecord, TResult>;
    <TRecordInner, TResultInner>(
      query: QueryBuilder<TRecordInner, TResultInner>
    ): QueryBuilder<TRecord, TResult>;
  }

  interface WhereIn<TRecord = any, TResult = unknown[]> {
    <K extends keyof TRecord>(
      columnName: K,
      values: TRecord[K][] | QueryCallback
    ): QueryBuilder<TRecord, TResult>;
    (columnName: string, values: Value[] | QueryCallback): QueryBuilder<
      TRecord,
      TResult
    >;
    <K extends keyof TRecord>(
      columnNames: K[],
      values: TRecord[K][][] | QueryCallback
    ): QueryBuilder<TRecord, TResult>;
    (columnNames: string[], values: Value[][] | QueryCallback): QueryBuilder<
      TRecord,
      TResult
    >;
    <K extends keyof TRecord, TRecordInner, TResultInner>(
      columnName: K,
      values: QueryBuilder<TRecordInner, TRecord[K]>
    ): QueryBuilder<TRecord, TResult>;
    <TRecordInner, TResultInner>(
      columnName: string,
      values: QueryBuilder<TRecordInner, TResultInner>
    ): QueryBuilder<TRecord, TResult>;
    <K extends keyof TRecord, TRecordInner, TResultInner>(
      columnNames: K[],
      values: QueryBuilder<TRecordInner, TRecord[K]>
    ): QueryBuilder<TRecord, TResult>;
    <TRecordInner, TResultInner>(
      columnNames: string[],
      values: QueryBuilder<TRecordInner, TResultInner>
    ): QueryBuilder<TRecord, TResult>;
  }

  // Note: Attempting to unify AsymmetricAggregation & TypePreservingAggregation
  // by extracting out a common base interface will not work because order of overloads
  // is significant.

  interface AsymmetricAggregation<TRecord = any, TResult = unknown[], TValue = any> {
    <TResult2 = AggregationQueryResult<TResult, Dict<TValue>>>(
      ...columnNames: (keyof TRecord)[]
    ): QueryBuilder<TRecord, TResult2>;
    <
      TAliases extends {} = Record<string, string | string[] | Knex.Raw>,
      TResult2 = AggregationQueryResult<TResult, {[k in keyof TAliases]?: TValue}>
    >(aliases: TAliases): QueryBuilder<TRecord, TResult2>;
    <TResult2 = AggregationQueryResult<TResult, Dict<TValue>>>(
      ...columnNames: Array<Record<string, string | string[] | Knex.Raw> | Knex.Raw | string>
    ): QueryBuilder<TRecord, TResult2>;
  }

  interface TypePreservingAggregation<TRecord = any, TResult = unknown[], TValue = any> {
    <
      TKey extends keyof TRecord,
      TResult2 = AggregationQueryResult<TResult, Dict<TRecord[TKey]>>
    >(
      ...columnNames: TKey[]
    ): QueryBuilder<TRecord, TResult2>;
    <
      TAliases extends {} = Record<string, string | string[] | Knex.Raw>,
      TResult2 = AggregationQueryResult<TResult, {
        // We have optional here because in most dialects aggregating by multiple keys simultaneously
        // causes rest of the keys to be dropped and only first to be considered
        [K in keyof TAliases]?: K extends keyof TRecord ?
          TRecord[K] :
          TValue
      }>
    >(aliases: TAliases): QueryBuilder<TRecord, TResult2>;
    <TResult2 = AggregationQueryResult<TResult, Dict<TValue>>>(
      ...columnNames: Array<Record<string, string | string[] | Knex.Raw> | Knex.Raw | string>
    ): QueryBuilder<TRecord, TResult2>;
  }

  interface GroupBy<TRecord = any, TResult = unknown[]>
    extends RawQueryBuilder<TRecord, TResult>,
      ColumnNameQueryBuilder<TRecord, TResult> {}

  interface OrderBy<TRecord = any, TResult = unknown[]> {
    (columnName: keyof TRecord, order?: 'asc' | 'desc'): QueryBuilder<
      TRecord,
      TResult
    >;
    (columnName: string, order?: string): QueryBuilder<TRecord, TResult>;
    (
      columnDefs: Array<
        keyof TRecord | { column: keyof TRecord; order?: 'asc' | 'desc' }
      >
    ): QueryBuilder<TRecord, TResult>;
    (
      columnDefs: Array<string | { column: string; order?: string }>
    ): QueryBuilder<TRecord, TResult>;
    <TRecordInner, TResultInner>(
      subQueryBuilder: QueryBuilder<TRecordInner, TResultInner>
    ): QueryBuilder<TRecord, TResult>;
  }

  interface Intersect<TRecord = any, TResult = unknown[]> {
    (
      callback: MaybeArray<QueryCallback | QueryBuilder<TRecord> | Raw>,
      wrap?: boolean
    ): QueryBuilder<TRecord, TResult>;
    (
      ...callbacks: (QueryCallback | Raw | QueryBuilder<TRecord>)[]
    ): QueryBuilder<TRecord, TResult>;
  }

  interface Union<TRecord = any, TResult = unknown[]>
    extends Intersect<TRecord, TResult> {}

  interface Having<TRecord = any, TResult = unknown[]>
    extends RawQueryBuilder<TRecord, TResult>,
      WhereWrapped<TRecord, TResult> {
    <K1 extends keyof TRecord, K2 extends keyof TRecord>(
      tableName: string,
      column1: K1,
      operator: ComparisonOperator,
      column2: K2
    ): QueryBuilder<TRecord, TResult>;
    (
      tableName: string,
      column1: string,
      operator: string,
      column2: string
    ): QueryBuilder<TRecord, TResult>;
  }

  interface HavingRange<TRecord = any, TResult = unknown[]> {
    <K extends keyof TRecord>(
      columnName: K,
      values: TRecord[K][]
    ): QueryBuilder<TRecord, TResult>;
    (columnName: string, values: Value[]): QueryBuilder<TRecord, TResult>;
  }

  // commons

  interface ColumnNameQueryBuilder<TRecord = any, TResult = unknown[]> {
    // When all columns are known to be keys of original record,
    // we can extend our selection by these columns
    (columnName: '*'): QueryBuilder<
      TRecord,
      ArrayIfAlready<TResult, DeferredKeySelection<TRecord, string>>
    >;

    <
      ColNameUT extends keyof TRecord,
      TResult2 = DeferredKeySelection.Augment<
        UnwrapArrayMember<TResult>,
        TRecord,
        ColNameUT & string
      >[]
    >(
      ...columnNames: ColNameUT[]
    ): QueryBuilder<TRecord, TResult2>;

    <
      ColNameUT extends keyof TRecord,
      TResult2 = DeferredKeySelection.Augment<
        UnwrapArrayMember<TResult>,
        TRecord,
        ColNameUT & string
      >[]
    >(
      columnNames: ColNameUT[]
    ): QueryBuilder<TRecord, TResult2>;

    // For non-inferrable column selection, we will allow consumer to
    // specify result type and if not widen the result to entire record type with any omissions permitted
    <
      TResult2 = DeferredKeySelection.Augment<
        UnwrapArrayMember<TResult>,
        SafePartial<TRecord>,
        keyof TRecord & string
      >[]
    >(
      ...columnNames: ColumnDescriptor<TRecord, TResult>[]
    ): QueryBuilder<TRecord, TResult2>;

    <
      TResult2 = DeferredKeySelection.Augment<
        UnwrapArrayMember<TResult>,
        SafePartial<TRecord>,
        keyof TRecord & string
      >[]
    >(
      columnNames: ColumnDescriptor<TRecord, TResult>[]
    ): QueryBuilder<TRecord, TResult2>;
  }

  type RawBinding = Value | QueryBuilder;

  interface RawQueryBuilder<TRecord = any, TResult = unknown[]> {
    <TResult2 = TResult>(
      sql: string,
      ...bindings: RawBinding[]
    ): QueryBuilder<TRecord, TResult2>;
    <TResult2 = TResult>(
      sql: string,
      bindings: RawBinding[] | ValueDict
    ): QueryBuilder<TRecord, TResult2>;
    <TResult2 = TResult>(raw: Raw<TResult2>): QueryBuilder<
      TRecord,
      TResult2
    >;
  }

  // Raw

  interface Raw<TResult = any>
    extends events.EventEmitter,
      ChainableInterface<ResolveResult<TResult>> {
    wrap<TResult2 = TResult>(before: string, after: string): Raw<TResult>;
    toSQL(): Sql;
    queryContext(context: any): Raw<TResult>;
    queryContext(): any;
  }

  interface RawBuilder<TRecord extends {} = any, TResult = any> {
    <TResult2 = TResult>(value: Value): Raw<TResult2>;
    <TResult2 = TResult>(sql: string, ...bindings: RawBinding[]): Raw<TResult2>;
    <TResult2 = TResult>(sql: string, bindings: RawBinding[] | ValueDict): Raw<TResult2>;
  }

  interface Ref<TSrc extends string, TMapping extends {}> extends Raw<string> {
      withSchema(schema: string): this;
      as<TAlias extends string>(alias: TAlias): Ref<TSrc, {[K in TAlias]: TSrc}>;
  }

  interface RefBuilder {
      <TSrc extends string>(src: TSrc): Ref<TSrc, {[K in TSrc]: TSrc}>;
  }

  //
  // QueryBuilder
  //

  type QueryCallback<TRecord = any, TResult = unknown[]> = (
    this: QueryBuilder<TRecord, TResult>,
    builder: QueryBuilder<TRecord, TResult>
  ) => void;

  type QueryCallbackWithArgs<TRecord = any, TResult = unknown[]> = (
    this: QueryBuilder<TRecord, TResult>,
    builder: QueryBuilder<TRecord, TResult>,
    ...args: any[]
  ) => void;

  interface QueryBuilder<
    TRecord extends {} = any,
    TResult = any
  >
    extends QueryInterface<TRecord, TResult>,
      ChainableInterface<ResolveResult<TResult>> {
    client: Client;
    or: QueryBuilder<TRecord, TResult>;
    not: QueryBuilder<TRecord, TResult>;
    and: QueryBuilder<TRecord, TResult>;

    // TODO: Promise?
    columnInfo(column?: keyof TRecord): Promise<ColumnInfo>;

    forUpdate(...tableNames: string[]): QueryBuilder<TRecord, TResult>;
    forUpdate(tableNames: string[]): QueryBuilder<TRecord, TResult>;

    forShare(...tableNames: string[]): QueryBuilder<TRecord, TResult>;
    forShare(tableNames: string[]): QueryBuilder<TRecord, TResult>;

    skipLocked(): QueryBuilder<TRecord, TResult>;
    noWait(): QueryBuilder<TRecord, TResult>;

    toSQL(): Sql;

    on(event: string, callback: Function): QueryBuilder<TRecord, TResult>;

    queryContext(context: any): QueryBuilder<TRecord, TResult>;
    queryContext(): any;

    clone(): QueryBuilder<TRecord, TResult>;
    timeout(ms: number, options?: {cancel?: boolean}): QueryBuilder<TRecord, TResult>;
  }

  interface Sql {
    method: string;
    options: any;
    bindings: Value[];
    sql: string;
    toNative(): SqlNative;
  }

  interface SqlNative {
    bindings: Value[];
    sql: string;
  }

  //
  // Chainable interface
  //

  type ExposedPromiseKeys =
    | "then"
    | "bind"
    | "catch"
    | "finally"
    | "asCallback"
    | "spread"
    | "map"
    | "reduce"
    | "thenReturn"
    | "return"
    | "yield"
    | "ensure"
    | "reflect"
    | "get"
    | "mapSeries"
    | "delay";

  interface ChainableInterface<T = any> extends Pick<Promise<T>, keyof Promise<T> & ExposedPromiseKeys> {
    toQuery(): string;
    options(options: { [key: string]: any }): this;
    connection(connection: any): this;
    debug(enabled: boolean): this;
    transacting(trx: Transaction): this;
    stream(handler: (readable: stream.PassThrough) => any): Promise<any>;
    stream(
      options: { [key: string]: any },
      handler: (readable: stream.PassThrough) => any
    ): Promise<any>;
    stream(options?: { [key: string]: any }): stream.PassThrough;
    pipe<T extends NodeJS.WritableStream>(
      writable: T,
      options?: { [key: string]: any }
    ): stream.PassThrough;
    asCallback(callback: Function): this;
  }

  interface Transaction<TRecord extends {} = any, TResult = any>
    extends Knex<TRecord, TResult> {
    executionPromise: Promise<TResult>;
    isCompleted: () => boolean;

    query<TRecord extends {} = any, TResult = void>(
      conn: any,
      sql: any,
      status: any,
      value: any
    ): QueryBuilder<TRecord, TResult>;
    savepoint<T = any>(
      transactionScope: (trx: Transaction) => any
    ): Promise<T>;
    commit(value?: any): QueryBuilder<TRecord, TResult>;
    rollback(error?: any): QueryBuilder<TRecord, TResult>;
  }

  //
  // Schema builder
  //

  interface SchemaBuilder extends ChainableInterface<void> {
    createTable(
      tableName: string,
      callback: (tableBuilder: CreateTableBuilder) => any
    ): SchemaBuilder;
    createTableIfNotExists(
      tableName: string,
      callback: (tableBuilder: CreateTableBuilder) => any
    ): SchemaBuilder;
    createSchema(schemaName: string): SchemaBuilder;
    createSchemaIfNotExists(schemaName: string): SchemaBuilder;
    alterTable(
      tableName: string,
      callback: (tableBuilder: CreateTableBuilder) => any
    ): SchemaBuilder;
    renameTable(oldTableName: string, newTableName: string): Promise<void>;
    dropTable(tableName: string): SchemaBuilder;
    hasTable(tableName: string): Promise<boolean>;
    hasColumn(tableName: string, columnName: string): Promise<boolean>;
    table(
      tableName: string,
      callback: (tableBuilder: AlterTableBuilder) => any
    ): Promise<void>;
    dropTableIfExists(tableName: string): SchemaBuilder;
    dropSchema(schemaName: string): SchemaBuilder;
    dropSchemaIfExists(schemaName: string): SchemaBuilder;
    raw(statement: string): SchemaBuilder;
    withSchema(schemaName: string): SchemaBuilder;
    queryContext(context: any): SchemaBuilder;
  }

  interface TableBuilder {
    increments(columnName?: string): ColumnBuilder;
    bigIncrements(columnName?: string): ColumnBuilder;
    dropColumn(columnName: string): TableBuilder;
    dropColumns(...columnNames: string[]): TableBuilder;
    renameColumn(from: string, to: string): ColumnBuilder;
    integer(columnName: string, length?: number): ColumnBuilder;
    bigInteger(columnName: string): ColumnBuilder;
    text(columnName: string, textType?: string): ColumnBuilder;
    string(columnName: string, length?: number): ColumnBuilder;
    float(
      columnName: string,
      precision?: number,
      scale?: number
    ): ColumnBuilder;
    decimal(
      columnName: string,
      precision?: number | null,
      scale?: number
    ): ColumnBuilder;
    boolean(columnName: string): ColumnBuilder;
    date(columnName: string): ColumnBuilder;
    dateTime(columnName: string, options?: {useTz?: boolean, precision?: number}): ColumnBuilder;
    time(columnName: string): ColumnBuilder;
    timestamp(columnName: string, options?: {useTz?: boolean, precision?: number}): ColumnBuilder;
    /** @deprecated */
    timestamp(columnName: string, withoutTz?: boolean, precision?: number): ColumnBuilder;
    timestamps(
      useTimestampType?: boolean,
      makeDefaultNow?: boolean
    ): ColumnBuilder;
    binary(columnName: string, length?: number): ColumnBuilder;
    enum(
      columnName: string,
      values: Value[],
      options?: EnumOptions
    ): ColumnBuilder;
    enu(
      columnName: string,
      values: Value[],
      options?: EnumOptions
    ): ColumnBuilder;
    json(columnName: string): ColumnBuilder;
    jsonb(columnName: string): ColumnBuilder;
    uuid(columnName: string): ColumnBuilder;
    comment(val: string): TableBuilder;
    specificType(columnName: string, type: string): ColumnBuilder;
    primary(columnNames: string[], constraintName?: string): TableBuilder;
    index(
      columnNames: string | (string | Raw)[],
      indexName?: string,
      indexType?: string
    ): TableBuilder;
    unique(columnNames: (string | Raw)[], indexName?: string): TableBuilder;
    foreign(column: string, foreignKeyName?: string): ForeignConstraintBuilder;
    foreign(
      columns: string[],
      foreignKeyName?: string
    ): MultikeyForeignConstraintBuilder;
    dropForeign(columnNames: string[], foreignKeyName?: string): TableBuilder;
    dropUnique(columnNames: (string | Raw)[], indexName?: string): TableBuilder;
    dropPrimary(constraintName?: string): TableBuilder;
    dropIndex(columnNames: string | (string | Raw)[], indexName?: string): TableBuilder;
    dropTimestamps(): ColumnBuilder;
    queryContext(context: any): TableBuilder;
  }

  interface CreateTableBuilder extends TableBuilder {
    engine(val: string): CreateTableBuilder;
    charset(val: string): CreateTableBuilder;
    collate(val: string): CreateTableBuilder;
    inherits(val: string): CreateTableBuilder;
  }

  interface AlterTableBuilder extends TableBuilder {}

  interface ColumnBuilder {
    index(indexName?: string): ColumnBuilder;
    primary(constraintName?: string): ColumnBuilder;
    unique(indexName?: string): ColumnBuilder;
    references(columnName: string): ReferencingColumnBuilder;
    onDelete(command: string): ColumnBuilder;
    onUpdate(command: string): ColumnBuilder;
    defaultTo(value: Value | null): ColumnBuilder;
    unsigned(): ColumnBuilder;
    notNullable(): ColumnBuilder;
    nullable(): ColumnBuilder;
    comment(value: string): ColumnBuilder;
    alter(): ColumnBuilder;
    queryContext(context: any): ColumnBuilder;
  }
  
  interface ForeignKeyBuilder {
    withKeyName(keyName: string): ColumnBuilder;
  }

  interface ForeignConstraintBuilder extends ForeignKeyBuilder {
    references(columnName: string): ReferencingColumnBuilder;
  }

  interface MultikeyForeignConstraintBuilder extends ForeignKeyBuilder {
    references(columnNames: string[]): ReferencingColumnBuilder;
  }

  interface PostgreSqlColumnBuilder extends ColumnBuilder {
    index(indexName?: string, indexType?: string): ColumnBuilder;
  }

  interface ReferencingColumnBuilder extends ColumnBuilder {
    inTable(tableName: string): ColumnBuilder;
  }

  interface AlterColumnBuilder extends ColumnBuilder {}

  interface MySqlAlterColumnBuilder extends AlterColumnBuilder {
    first(): AlterColumnBuilder;
    after(columnName: string): AlterColumnBuilder;
  }

  //
  // Configurations
  //

  interface ColumnInfo {
    defaultValue: Value;
    type: string;
    maxLength: number;
    nullable: boolean;
  }

  interface Config<SV extends {} = any> {
    debug?: boolean;
    client?: string | typeof Client;
    dialect?: string;
    version?: string;
    connection?: string | StaticConnectionConfig | ConnectionConfigProvider;
    pool?: PoolConfig;
    migrations?: MigratorConfig;
    postProcessResponse?: (result: any, queryContext: any) => any;
    wrapIdentifier?: (
      value: string,
      origImpl: (value: string) => string,
      queryContext: any
    ) => string;
    seeds?: SeedsConfig<SV>;
    acquireConnectionTimeout?: number;
    useNullAsDefault?: boolean;
    searchPath?: string | string[];
    asyncStackTraces?: boolean;
    log?: Logger;
  }

  type StaticConnectionConfig =
    | ConnectionConfig
    | MariaSqlConnectionConfig
    | MySqlConnectionConfig
    | MsSqlConnectionConfig
    | OracleDbConnectionConfig
    | PgConnectionConfig
    | RedshiftConnectionConfig
    | Sqlite3ConnectionConfig
    | SocketConnectionConfig;

  type ConnectionConfigProvider  = SyncConnectionConfigProvider | AsyncConnectionConfigProvider;
  type SyncConnectionConfigProvider  = () => StaticConnectionConfig;
  type AsyncConnectionConfigProvider  = () => Promise<StaticConnectionConfig>;

  interface ConnectionConfig {
    host: string;
    user: string;
    password: string;
    database: string;
    domain?: string;
    instanceName?: string;
    debug?: boolean;
    requestTimeout?: number;
  }

  // Config object for mssql: see https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/mssql/index.d.ts
  interface MsSqlConnectionConfig {
    driver?: string;
    user?: string;
    password?: string;
    server: string;
    port?: number;
    domain?: string;
    database: string;
    connectionTimeout?: number;
    requestTimeout?: number;
    stream?: boolean;
    parseJSON?: boolean;
    expirationChecker?(): boolean;
    options?: {
      encrypt?: boolean;
      instanceName?: string;
      useUTC?: boolean;
      tdsVersion?: string;
      appName?: string;
      abortTransactionOnError?: boolean;
      trustedConnection?: boolean;
      enableArithAbort?: boolean;
    };
    pool?: {
      min?: number;
      max?: number;
      idleTimeoutMillis?: number;
      maxWaitingClients?: number;
      testOnBorrow?: boolean;
      acquireTimeoutMillis?: number;
      fifo?: boolean;
      priorityRange?: number;
      autostart?: boolean;
      evictionRunIntervalMillis?: number;
      numTestsPerRun?: number;
      softIdleTimeoutMillis?: number;
      Promise?: any;
    };
  }

  // Config object for mariasql: https://github.com/mscdex/node-mariasql#client-methods
  interface MariaSqlConnectionConfig {
    user?: string;
    password?: string;
    host?: string;
    port?: number;
    unixSocket?: string;
    protocol?: string;
    db?: string;
    keepQueries?: boolean;
    multiStatements?: boolean;
    connTimeout?: number;
    pingInterval?: number;
    secureAuth?: boolean;
    compress?: boolean;
    ssl?: boolean | MariaSslConfiguration;
    local_infile?: boolean;
    read_default_file?: string;
    read_default_group?: string;
    charset?: string;
    streamHWM?: number;
    expirationChecker?(): boolean;
  }

  interface MariaSslConfiguration {
    key?: string;
    cert?: string;
    ca?: string;
    capath?: string;
    cipher?: string;
    rejectUnauthorized?: boolean;
    expirationChecker?(): boolean;
  }

  // Config object for mysql: https://github.com/mysqljs/mysql#connection-options
  interface MySqlConnectionConfig {
    host?: string;
    port?: number;
    localAddress?: string;
    socketPath?: string;
    user?: string;
    password?: string;
    database?: string;
    charset?: string;
    timezone?: string;
    connectTimeout?: number;
    stringifyObjects?: boolean;
    insecureAuth?: boolean;
    typeCast?: any;
    queryFormat?: (query: string, values: any) => string;
    supportBigNumbers?: boolean;
    bigNumberStrings?: boolean;
    dateStrings?: boolean;
    debug?: boolean;
    trace?: boolean;
    multipleStatements?: boolean;
    flags?: string;
    ssl?: string | MariaSslConfiguration;
    decimalNumbers?: boolean;
    expirationChecker?(): boolean;
  }

  interface OracleDbConnectionConfig {
    host: string;
    user: string;
    password?: string;
    database?: string;
    domain?: string;
    instanceName?: string;
    debug?: boolean;
    requestTimeout?: number;
    connectString?: string;
    expirationChecker?(): boolean;
  }

  // Config object for pg: https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/pg/index.d.ts
  interface PgConnectionConfig {
    user?: string;
    database?: string;
    password?: string;
    port?: number;
    host?: string;
    connectionString?: string;
    keepAlive?: boolean;
    stream?: stream.Duplex;
    statement_timeout?: false | number;
    connectionTimeoutMillis?: number;
    keepAliveInitialDelayMillis?: number;
    ssl?: boolean | ConnectionOptions;
  }

  type RedshiftConnectionConfig = PgConnectionConfig;

  /** Used with SQLite3 adapter */
  interface Sqlite3ConnectionConfig {
    filename: string;
    debug?: boolean;
    expirationChecker?(): boolean;
  }

  interface SocketConnectionConfig {
    socketPath: string;
    user: string;
    password: string;
    database: string;
    debug?: boolean;
    expirationChecker?(): boolean;
  }

  interface PoolConfig {
    name?: string;
    afterCreate?: Function;
    min?: number;
    max?: number;
    refreshIdle?: boolean;
    idleTimeoutMillis?: number;
    reapIntervalMillis?: number;
    returnToHead?: boolean;
    priorityRange?: number;
    log?: (message: string, logLevel: string) => void;

    // generic-pool v3 configs
    maxWaitingClients?: number;
    testOnBorrow?: boolean;
    acquireTimeoutMillis?: number;
    fifo?: boolean;
    autostart?: boolean;
    evictionRunIntervalMillis?: number;
    numTestsPerRun?: number;
    softIdleTimeoutMillis?: number;
    Promise?: any;
  }

  type LogFn = (message: any) => void;

  interface Logger {
    warn?: LogFn;
    error?: LogFn;
    debug?: LogFn;
    inspectionDepth?: number;
    enableColors?: boolean;
    deprecate?: (method: string, alternative: string) => void;
  }

  interface MigratorConfig {
    database?: string;
    directory?: string | string[];
    extension?: string;
    stub?: string;
    tableName?: string;
    schemaName?: string;
    disableTransactions?: boolean;
    disableMigrationsListValidation?: boolean;
    sortDirsSeparately?: boolean;
    loadExtensions?: string[];
    migrationSource?: any;
  }

  interface SeedsConfig<V extends {} = any> {
    directory?: string;
    extension?: string;
    loadExtensions?: string[];
    stub?: string;
    variables?: V;
  }

  interface Migrator {
    make(name: string, config?: MigratorConfig): Promise<string>;
    latest(config?: MigratorConfig): Promise<any>;
    rollback(config?: MigratorConfig, all?: boolean): Promise<any>;
    status(config?: MigratorConfig): Promise<number>;
    currentVersion(config?: MigratorConfig): Promise<string>;
    list(config?: MigratorConfig): Promise<any>;
    up(config?: MigratorConfig): Promise<any>;
    down(config?: MigratorConfig): Promise<any>;
    forceFreeMigrationsLock(config?: MigratorConfig): Promise<any>;
  }

  interface SeederConfig {
    extension?: string;
    directory?: string;
    loadExtensions?: string[];
    specific?: string;
  }

  class Seeder {
    constructor(knex: Knex);
    setConfig(config: SeederConfig): SeederConfig;
    run(config?: SeederConfig): Promise<[string[]]>;
    make(name: string, config?: SeederConfig): Promise<string>;
  }

  interface FunctionHelper {
    now(precision?: number): Raw;
  }

  interface EnumOptions {
    useNative: boolean;
    existingType?: boolean;
    schemaName?: string;
    enumName: string;
  }

  //
  // Clients
  //

  class Client extends events.EventEmitter {
    constructor(config: Config);
    config: Config;
    dialect: string;
    driverName: string;
    connectionSettings: object;

    acquireRawConnection(): Promise<any>;
    destroyRawConnection(connection: any): Promise<void>;
    validateConnection(connection: any): Promise<boolean>;
    logger: Logger;
    version?: string;
    connectionConfigProvider: any;
    connectionConfigExpirationChecker: null | (() => boolean);
    valueForUndefined: any;
    formatter(builder: any): any;
    queryBuilder(): QueryBuilder;
    queryCompiler(builder: any): any;
    schemaBuilder(): SchemaBuilder;
    schemaCompiler(builder: SchemaBuilder): any;
    tableBuilder(type: any, tableName: any, fn: any): TableBuilder;
    tableCompiler(tableBuilder: any): any;
    columnBuilder(tableBuilder: any, type: any, args: any): ColumnBuilder;
    columnCompiler(tableBuilder: any, columnBuilder: any): any;
    runner(builder: any): any;
    transaction(container: any, config: any, outerTx: any): Transaction;
    raw(...args: any[]): any;
    ref(...args: any[]): Ref<any, any>;
    query(connection: any, obj: any): any;
    stream(connection: any, obj: any, stream: any, options: any): any;
    prepBindings(bindings: any): any;
    positionBindings(sql: any): any;
    postProcessResponse(resp: any, queryContext: any): any;
    wrapIdentifier(value: any, queryContext: any): any;
    customWrapIdentifier(value: any, origImpl: any, queryContext: any): any;
    wrapIdentifierImpl(value: any): string;
    initializeDriver(): void;
    driver: any;
    poolDefaults(): {
        min: number;
        max: number;
        propagateCreateError: boolean;
    };
    getPoolSettings(poolConfig: any): any;
    initializePool(config?: {}): void;
    pool: tarn.Pool<any> | undefined;
    acquireConnection(): any;
    releaseConnection(connection: any): any;
    destroy(callback: any): any;
    database(): any;
    canCancelQuery: boolean;
    assertCanCancelQuery(): void;
    cancelQuery(): void;
  }

  class QueryBuilder {
    static extend(
      methodName: string,
      fn: <TRecord extends {} = any, TResult = unknown[]>(
        this: QueryBuilder<TRecord, TResult>,
        ...args: any[]
      ) => QueryBuilder<TRecord, TResult>
    ): void;
  }

  export class KnexTimeoutError extends Error {}
}

export = Knex;
