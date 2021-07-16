// Originally based on contributions to DefinitelyTyped:
// Definitions by: Qubo <https://github.com/tkQubo>
//                 Pablo Rodríguez <https://github.com/MeLlamoPablo>
//                 Matt R. Wilson <https://github.com/mastermatt>
//                 Satana Charuwichitratana <https://github.com/micksatana>
//                 Shrey Jain <https://github.com/shreyjain1994>
// TypeScript Version: 4.1

import tarn = require('tarn');
import events = require('events');
import stream = require('stream');
import ResultTypes = require('./result');

import { Tables } from './tables';

import { ConnectionOptions } from "tls";
import { Stream } from "stream";

// # Generic type-level utilities

// If T is object then make it a partial otherwise fallback to any
//
// This is primarily to prevent type incompatibilities where target can be unknown.
// While unknown can be assigned to any, Partial<unknown> can't be.
type SafePartial<T> = Partial<AnyOrUnknownToOther<T, {}>>;

type MaybeArray<T> = T | T[];

type StrKey<T> = string & keyof T;

// If T is unknown then convert to any, else retain original
type UnknownToAny<T> = unknown extends T ? any : T;
type AnyToUnknown<T> = unknown extends T ? unknown : T;
type AnyOrUnknownToOther<T1, T2> = unknown extends T1 ? T2 : T1;

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

type ArrayIfAlready<T1, T2> = AnyToUnknown<T1> extends any[] ? T2[] : T2;

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
    ? Knex.ResolveTableType<ResolveOne<TSelection>>
    : TSelection extends DeferredKeySelection.Any[]
    ? Knex.ResolveTableType<ResolveOne<TSelection[0]>>[]
    : TSelection extends (infer I)[]
    ? UnknownToAny<Knex.ResolveTableType<I>>[]
    : UnknownToAny<Knex.ResolveTableType<TSelection>>;
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

interface DMLOptions {
  includeTriggerModifications?: boolean;
}

export interface Knex<TRecord extends {} = any, TResult = unknown[]>
  extends Knex.QueryInterface<TRecord, TResult>, events.EventEmitter {
  <TTable extends Knex.TableNames>(
    tableName: TTable,
    options?: TableOptions
  ): Knex.QueryBuilder<Knex.TableType<TTable>, DeferredKeySelection<Knex.ResolveTableType<Knex.TableType<TTable>>, never>[]>;
  <TRecord2 = TRecord, TResult2 = DeferredKeySelection<TRecord2, never>[]>(
    tableName?: Knex.TableDescriptor | Knex.AliasDict,
    options?: TableOptions
  ): Knex.QueryBuilder<TRecord2, TResult2>;
  VERSION: string;
  __knex__: string;

  raw: Knex.RawBuilder<TRecord>;

  transactionProvider(
    config?: Knex.TransactionConfig
  ): Knex.TransactionProvider;
  transaction(
    config?: Knex.TransactionConfig
  ): Promise<Knex.Transaction>;
  transaction(
    transactionScope?: null,
    config?: Knex.TransactionConfig
  ): Promise<Knex.Transaction>;
  transaction<T>(
    transactionScope: (trx: Knex.Transaction) => Promise<T> | void,
    config?: Knex.TransactionConfig
  ): Promise<T>;
  initialize(config?: Knex.Config): void;
  destroy(callback: Function): void;
  destroy(): Promise<void>;

  batchInsert<TRecord2 = TRecord, TResult2 = number[]>(
    tableName: Knex.TableDescriptor,
    data: TRecord2 extends Knex.CompositeTableType<unknown>
      ? ReadonlyArray<Knex.ResolveTableType<TRecord2, 'insert'>>
      : ReadonlyArray<Knex.DbRecordArr<TRecord2>>,
    chunkSize?: number,
  ): Knex.BatchInsertBuilder<TRecord2, TResult2>;

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
  userParams: Record<string, any>;
  withUserParams(params: Record<string, any>): Knex;
  isTransaction?: boolean;
}

export declare function knex<TRecord extends {} = any, TResult = unknown[]>(
  config: Knex.Config | string
): Knex<TRecord, TResult>;

export declare namespace knex {
  class QueryBuilder {
    static extend(
      methodName: string,
      fn: <TRecord extends {} = any, TResult = unknown[]>(
        this: Knex.QueryBuilder<TRecord, TResult>,
        ...args: any[]
      ) => Knex.QueryBuilder<TRecord, TResult>
    ): void;
  }

  export class KnexTimeoutError extends Error {}

  export const Client: typeof Knex.Client;
}

export declare namespace Knex {
  //
  // Utility Types
  //

  type Value =
    | string
    | number
    | boolean
    | null
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

  type MaybeRawColumn<TColumn> = TColumn | Raw<TColumn>;

  type MaybeRawRecord<TRecord> = {
    [K in keyof TRecord]: MaybeRawColumn<TRecord[K]>
  };

  type DbColumn<TColumn> = Readonly<MaybeRawColumn<TColumn>>;

  type DbRecord<TRecord> = Readonly<SafePartial<MaybeRawRecord<TRecord>>>;

  type DbRecordArr<TRecord> = Readonly<MaybeArray<DbRecord<TRecord>>>;

  export type CompositeTableType<TBase, TInsert = TBase, TUpdate = Partial<TInsert>> = {
    base: TBase,
    insert: TInsert,
    update: TUpdate,
  };

  type TableNames = keyof Tables;

  type TableInterfaceScope = keyof CompositeTableType<unknown>;

  type TableType<TTable extends keyof Tables> = Tables[TTable];

  type ResolveTableType<TCompositeTableType, TScope extends TableInterfaceScope = 'base'> = TCompositeTableType extends CompositeTableType<unknown>
    ? TCompositeTableType[TScope]
    : TCompositeTableType;

  interface OnConflictQueryBuilder<TRecord, TResult> {
    ignore(): QueryBuilder<TRecord, TResult>;
    merge(mergeColumns?: (keyof TRecord)[]): QueryBuilder<TRecord, TResult>;
    merge(data?: Extract<DbRecord<ResolveTableType<TRecord, 'update'>>, object>): QueryBuilder<TRecord, TResult>;
  }

  //
  // QueryInterface
  //
  type ClearStatements = "with" | "select" | "columns" | "hintComments" | "where" | "union" | "join" | "group" | "order" | "having" | "limit" | "offset" | "counter" | "counters";

  interface QueryInterface<TRecord extends {} = any, TResult = any> {
    select: Select<TRecord, TResult>;
    as: As<TRecord, TResult>;
    columns: Select<TRecord, TResult>;
    column: Select<TRecord, TResult>;
    hintComment: HintComment<TRecord, TResult>;
    from: Table<TRecord, TResult>;
    into: Table<TRecord, TResult>;
    table: Table<TRecord, TResult>;
    distinct: Distinct<TRecord, TResult>;
    distinctOn: DistinctOn<TRecord, TResult>;

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
    whereLike: Where<TRecord, TResult>;
    whereIlike: Where<TRecord, TResult>;
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

    // Partition by
    partitionBy: PartitionBy<TRecord, TResult>;

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
    havingNotIn: HavingRange<TRecord, TResult>;
    andHavingNotIn: HavingRange<TRecord, TResult>;
    orHavingNotIn: HavingRange<TRecord, TResult>;

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
    clearGroup(): QueryBuilder<TRecord, TResult>;
    clearOrder(): QueryBuilder<TRecord, TResult>;
    clearHaving(): QueryBuilder<TRecord, TResult>;
    clearCounters(): QueryBuilder<TRecord, TResult>;
    clear(statement: ClearStatements): QueryBuilder<TRecord, TResult>;

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

    // Analytics
    rank: AnalyticFunction<TRecord, TResult>;
    denseRank: AnalyticFunction<TRecord, TResult>;
    rowNumber: AnalyticFunction<TRecord, TResult>;

    // Others
    first: Select<TRecord, DeferredKeySelection.AddUnionMember<UnwrapArrayMember<TResult>, undefined>>;

    pluck<K extends keyof TRecord>(
      column: K
    ): QueryBuilder<TRecord, TRecord[K][]>;
    pluck<TResult2 extends {}>(column: string): QueryBuilder<TRecord, TResult2>;

    insert(
      data: TRecord extends CompositeTableType<unknown>
        ? ResolveTableType<TRecord, 'insert'> | ReadonlyArray<ResolveTableType<TRecord, 'insert'>>
        : DbRecordArr<TRecord> | ReadonlyArray<DbRecordArr<TRecord>>,
      returning: '*',
      options?: DMLOptions
    ): QueryBuilder<TRecord, DeferredKeySelection<TRecord, never>[]>;
    insert<
      TKey extends StrKey<ResolveTableType<TRecord>>,
      TResult2 = DeferredIndex.Augment<
        UnwrapArrayMember<TResult>,
        ResolveTableType<TRecord>,
        TKey
      >[]
    >(
      data: TRecord extends CompositeTableType<unknown>
        ? ResolveTableType<TRecord, 'insert'> | ReadonlyArray<ResolveTableType<TRecord, 'insert'>>
        : DbRecordArr<TRecord> | ReadonlyArray<DbRecordArr<TRecord>>,
      returning: TKey,
      options?: DMLOptions
    ): QueryBuilder<TRecord, TResult2>;
    insert<
      TKey extends StrKey<ResolveTableType<TRecord>>,
      TResult2 = DeferredKeySelection.Augment<
        UnwrapArrayMember<TResult>,
        ResolveTableType<TRecord>,
        TKey
      >[]
    >(
      data: TRecord extends CompositeTableType<unknown>
        ? ResolveTableType<TRecord, 'insert'> | ReadonlyArray<ResolveTableType<TRecord, 'insert'>>
        : DbRecordArr<TRecord> | ReadonlyArray<DbRecordArr<TRecord>>,
      returning: readonly TKey[],
      options?: DMLOptions
    ): QueryBuilder<TRecord, TResult2>;
    insert<
      TKey extends string,
      TResult2 = DeferredIndex.Augment<
        UnwrapArrayMember<TResult>,
        TRecord,
        TKey
      >[]
    >(
      data: TRecord extends CompositeTableType<unknown>
        ? ResolveTableType<TRecord, 'insert'> | ReadonlyArray<ResolveTableType<TRecord, 'insert'>>
        : DbRecordArr<TRecord> | ReadonlyArray<DbRecordArr<TRecord>>,
      returning: TKey,
      options?: DMLOptions
    ): QueryBuilder<TRecord, TResult2>;
    insert<
      TKey extends string,
      TResult2 = DeferredIndex.Augment<
        UnwrapArrayMember<TResult>,
        TRecord,
        TKey
      >[]
    >(
      data: TRecord extends CompositeTableType<unknown>
        ? ResolveTableType<TRecord, 'insert'> | ReadonlyArray<ResolveTableType<TRecord, 'insert'>>
        : DbRecordArr<TRecord> | ReadonlyArray<DbRecordArr<TRecord>>,
      returning: readonly TKey[],
      options?: DMLOptions
    ): QueryBuilder<TRecord, TResult2>;
    insert<TResult2 = number[]>(
      data: TRecord extends CompositeTableType<unknown>
        ? ResolveTableType<TRecord, 'insert'> | ReadonlyArray<ResolveTableType<TRecord, 'insert'>>
        : DbRecordArr<TRecord> | ReadonlyArray<DbRecordArr<TRecord>>
    ): QueryBuilder<TRecord, TResult2>;

    modify<TRecord2 extends {} = any, TResult2 extends {} = any>(
      callback: QueryCallbackWithArgs<TRecord, any>,
      ...args: any[]
    ): QueryBuilder<TRecord2, TResult2>;
    update<
      K1 extends StrKey<ResolveTableType<TRecord, 'update'>>,
      K2 extends StrKey<ResolveTableType<TRecord>>,
      TResult2 = DeferredIndex.Augment<
        UnwrapArrayMember<TResult>,
        ResolveTableType<TRecord>,
        K2
      >[]
    >(
      columnName: K1,
      value: DbColumn<ResolveTableType<TRecord, 'update'>[K1]>,
      returning: K2,
      options?: DMLOptions
    ): QueryBuilder<TRecord, TResult2>;
    update<
      K1 extends StrKey<ResolveTableType<TRecord, 'update'>>,
      K2 extends StrKey<ResolveTableType<TRecord>>,
      TResult2 = DeferredKeySelection.Augment<
        UnwrapArrayMember<TResult>,
        ResolveTableType<TRecord>,
        K2
      >[]
    >(
      columnName: K1,
      value: DbColumn<ResolveTableType<TRecord, 'update'>[K1]>,
      returning: readonly K2[],
      options?: DMLOptions
    ): QueryBuilder<TRecord, TResult2>;
    update<K extends keyof TRecord>(
      columnName: K,
      value: DbColumn<TRecord[K]>
    ): QueryBuilder<TRecord, number>;
    update<TResult2 = SafePartial<TRecord>[]>(
      columnName: string,
      value: Value,
      returning: string | readonly string[],
      options?: DMLOptions
    ): QueryBuilder<TRecord, TResult2>;
    update(
      data: DbRecordArr<TRecord>,
      returning: '*',
      options?: DMLOptions
    ): QueryBuilder<TRecord, DeferredKeySelection<TRecord, never>[]>;
    update<
      TKey extends StrKey<ResolveTableType<TRecord>>,
      TResult2 = DeferredIndex.Augment<
        UnwrapArrayMember<TResult>,
        ResolveTableType<TRecord>,
        TKey
      >[]
    >(
      data: TRecord extends CompositeTableType<unknown> ? ResolveTableType<TRecord, 'update'> : DbRecordArr<TRecord>,
      returning: TKey,
      options?: DMLOptions
    ): QueryBuilder<TRecord, TResult2>;
    update<
      TKey extends StrKey<ResolveTableType<TRecord>>,
      TResult2 = DeferredKeySelection.Augment<
        UnwrapArrayMember<TResult>,
        ResolveTableType<TRecord>,
        TKey
      >[]
    >(
      data: TRecord extends CompositeTableType<unknown> ? ResolveTableType<TRecord, 'update'> : DbRecordArr<TRecord>,
      returning: readonly TKey[],
      options?: DMLOptions
    ): QueryBuilder<TRecord, TResult2>;
    update<
      TKey extends string = string,
      TResult2 extends {}[] = DeferredKeySelection.Augment<
        UnwrapArrayMember<TResult>,
        TRecord,
        TKey
      >[]
    >(
      data: TRecord extends CompositeTableType<unknown> ? ResolveTableType<TRecord, 'update'> : DbRecordArr<TRecord>,
      returning: TKey | readonly TKey[],
      options?: DMLOptions
    ): QueryBuilder<TRecord, TResult2>;
    update<
      TKey extends string,
      TResult2 extends {}[] = DeferredKeySelection.Augment<
        UnwrapArrayMember<TResult>,
        TRecord,
        TKey
      >[]
    >(
      data: TRecord extends CompositeTableType<unknown> ? ResolveTableType<TRecord, 'update'> : DbRecordArr<TRecord>,
      returning: readonly TKey[],
      options?: DMLOptions
    ): QueryBuilder<TRecord, TResult2>;
    update<TResult2 = number>(
      data: TRecord extends CompositeTableType<unknown> ? ResolveTableType<TRecord, 'update'> : DbRecordArr<TRecord>
    ): QueryBuilder<TRecord, TResult2>;

    update<TResult2 = number>(columnName: string, value: Value): QueryBuilder<TRecord, TResult2>;

    returning(column: '*', options?: DMLOptions): QueryBuilder<TRecord, DeferredKeySelection<TRecord, never>[]>;
    returning<
      TKey extends StrKey<ResolveTableType<TRecord>>,
      TResult2 = DeferredIndex.Augment<
        UnwrapArrayMember<TResult>,
        ResolveTableType<TRecord>,
        TKey
      >[]
    >(
      column: TKey,
      options?: DMLOptions
    ): QueryBuilder<TRecord, TResult2>;
    returning<
      TKey extends StrKey<ResolveTableType<TRecord>>,
      TResult2 = DeferredKeySelection.SetSingle<
        DeferredKeySelection.Augment<UnwrapArrayMember<TResult>, ResolveTableType<TRecord>, TKey>,
        false
      >[]
    >(
      columns: readonly TKey[],
      options?: DMLOptions
    ): QueryBuilder<TRecord, TResult2>;
    returning<TResult2 = SafePartial<TRecord>[]>(
      column: string | readonly string[],
      options?: DMLOptions
    ): QueryBuilder<TRecord, TResult2>;

    onConflict<
      TKey extends StrKey<ResolveTableType<TRecord>>,
      TResult2 = DeferredIndex.Augment<
        UnwrapArrayMember<TResult>,
        TRecord,
        TKey
      >[]
    >(
      column: TKey
    ): OnConflictQueryBuilder<TRecord, TResult2>;
    onConflict<
      TKey extends StrKey<ResolveTableType<TRecord>>,
      TResult2 = DeferredKeySelection.SetSingle<
        DeferredKeySelection.Augment<UnwrapArrayMember<TResult>, TRecord, TKey>,
        false
      >[]
    >(
      columns: readonly TKey[]
    ): OnConflictQueryBuilder<TRecord, TResult2>;

    onConflict(
      columns: string
    ): OnConflictQueryBuilder<TRecord, TResult>;

    onConflict(
      columns: string[]
    ): OnConflictQueryBuilder<TRecord, TResult>;

    onConflict(): OnConflictQueryBuilder<TRecord, TResult>;

    del(
      returning: '*',
      options?: DMLOptions
    ): QueryBuilder<TRecord, DeferredKeySelection<TRecord, never>[]>;
    del<
      TKey extends StrKey<TRecord>,
      TResult2 = DeferredIndex.Augment<
        UnwrapArrayMember<TResult>,
        TRecord,
        TKey
      >[]
    >(
      returning: TKey,
      options?: DMLOptions
    ): QueryBuilder<TRecord, TResult2>;
    del<
      TKey extends StrKey<TRecord>,
      TResult2 = DeferredKeySelection.Augment<
        UnwrapArrayMember<TResult>,
        TRecord,
        TKey
      >[]
    >(
      returning: readonly TKey[],
      options?: DMLOptions
    ): QueryBuilder<TRecord, TResult2[]>;
    del<TResult2 = SafePartial<TRecord>[]>(
      returning: string | readonly string[],
      options?: DMLOptions
    ): QueryBuilder<TRecord, TResult2>;
    del<TResult2 = number>(): QueryBuilder<TRecord, TResult2>;

    delete(
      returning: '*',
      options?: DMLOptions
    ): QueryBuilder<TRecord, DeferredKeySelection<TRecord, never>[]>;
    delete<
      TKey extends StrKey<ResolveTableType<TRecord>>,
      TResult2 = DeferredIndex.Augment<
        UnwrapArrayMember<TResult>,
        ResolveTableType<TRecord>,
        TKey
      >[]
    >(
      returning: TKey,
      options?: DMLOptions
    ): QueryBuilder<TRecord, TResult2>;
    delete<
      TKey extends StrKey<TRecord>,
      TResult2 = DeferredKeySelection.Augment<
        UnwrapArrayMember<TResult>,
        TRecord,
        TKey
      >[]
    >(
      returning: readonly TKey[],
      options?: DMLOptions
    ): QueryBuilder<TRecord, TResult2>;
    delete<TResult2 = any>(
      returning: string | readonly string[],
      options?: DMLOptions
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
      AliasUT extends InferrableColumnDescriptor<ResolveTableType<TRecord>>[],
      TResult2 = ArrayIfAlready<TResult, DeferredKeySelection.Augment<
        UnwrapArrayMember<TResult>,
        ResolveTableType<TRecord>,
        IncompatibleToAlt<ArrayMember<AliasUT>, string, never>,
        IntersectAliases<AliasUT>
      >>
      >(
      ...aliases: AliasUT
    ): QueryBuilder<TRecord, TResult2>;

    <
      AliasUT extends InferrableColumnDescriptor<ResolveTableType<TRecord>>[],
      TResult2 = ArrayIfAlready<TResult, DeferredKeySelection.Augment<
        UnwrapArrayMember<TResult>,
        ResolveTableType<TRecord>,
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
        ResolveTableType<TRecord>,
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
      ...subQueryBuilders: readonly QueryBuilder<TInnerRecord, TInnerResult>[]
    ): QueryBuilder<TRecord, TResult2>;

    <TResult2 = ArrayIfAlready<TResult, any>, TInnerRecord = any, TInnerResult = any>(
      subQueryBuilders: readonly QueryBuilder<TInnerRecord, TInnerResult>[]
    ): QueryBuilder<TRecord, TResult2>;
  }

  interface HintComment<TRecord extends {} = any, TResult extends {} = any> {
    (hint: string): QueryBuilder<TRecord, TResult>;
    (hints: readonly string[]): QueryBuilder<TRecord, TResult>;
  }

  interface Table<TRecord extends {} = any, TResult extends {} = any> {
    <
      TTable extends TableNames,
      TRecord2 = TableType<TTable>,
      TResult2 = DeferredKeySelection.ReplaceBase<TResult, ResolveTableType<TRecord2>>
      >(
      tableName: TTable,
      options?: TableOptions
    ): QueryBuilder<TRecord2, TResult2>;
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

  interface DistinctOn<TRecord extends {}, TResult = {}[]> {
    <ColNameUT extends keyof TRecord>(
      ...columnNames: readonly ColNameUT[]
    ): QueryBuilder<TRecord, TResult>;

    <ColNameUT extends keyof TRecord>(
      columnNames: readonly ColNameUT[]
    ): QueryBuilder<TRecord, TResult>;

    (...columnNames: readonly string[]): QueryBuilder<TRecord, TResult>;
    (columnNames: readonly string[]): QueryBuilder<TRecord, TResult>;
  }

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
      TTable extends TableNames,
      TRecord2 = ResolveTableType<TRecord> &
        ResolveTableType<TableType<TTable>>,
      TResult2 = DeferredKeySelection.ReplaceBase<TResult, TRecord2>
    >(
      tableName: TTable,
      clause: JoinCallback
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
      TTable1 extends TableNames,
      TTable2 extends TableNames,
      TKey1 extends StrKey<ResolveTableType<TableType<TTable1>>> & StrKey<TRecord1>,
      TKey2 extends StrKey<ResolveTableType<TableType<TTable2>>>,
      TRecord1 = ResolveTableType<TRecord>,
      TRecord2 = TRecord1 & ResolveTableType<TableType<TTable2>>,
      TResult2 = DeferredKeySelection.ReplaceBase<TResult, TRecord2>
    >(
      tableName: TTable2,
      column1: `${TTable1}.${TKey1}`,
      column2: `${TTable2}.${TKey2}`
    ): QueryBuilder<TRecord2, TResult2>;
    <
      TTable1 extends TableNames,
      TTable2 extends TableNames,
      TKey1 extends StrKey<ResolveTableType<TableType<TTable1>>> & StrKey<TRecord1>,
      TKey2 extends StrKey<ResolveTableType<TableType<TTable2>>>,
      TRecord1 = ResolveTableType<TRecord>,
      TRecord2 = TRecord1 & ResolveTableType<TableType<TTable2>>,
      TResult2 = DeferredKeySelection.ReplaceBase<TResult, TRecord2>
    >(
      tableName: TTable2,
      column1: `${TTable2}.${TKey2}`,
      column2: `${TTable1}.${TKey1}`
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
      TTable1 extends TableNames,
      TTable2 extends TableNames,
      TKey1 extends StrKey<ResolveTableType<TableType<TTable1>>> & StrKey<TRecord1>,
      TKey2 extends StrKey<ResolveTableType<TableType<TTable2>>>,
      TRecord1 = ResolveTableType<TRecord>,
      TRecord2 = TRecord1 & ResolveTableType<TableType<TTable2>>,
      TResult2 = DeferredKeySelection.ReplaceBase<TResult, TRecord2>
    >(
      tableName: TTable2,
      column1: `${TTable1}.${TKey1}`,
      operator: string,
      column2: `${TTable2}.${TKey2}`
    ): QueryBuilder<TRecord2, TResult2>;
    <
      TTable1 extends TableNames,
      TTable2 extends TableNames,
      TKey1 extends StrKey<ResolveTableType<TableType<TTable1>>> & StrKey<TRecord1>,
      TKey2 extends StrKey<ResolveTableType<TableType<TTable2>>>,
      TRecord1 = ResolveTableType<TRecord>,
      TRecord2 = TRecord1 & ResolveTableType<TableType<TTable2>>,
      TResult2 = DeferredKeySelection.ReplaceBase<TResult, TRecord2>
    >(
      tableName: TTable2,
      column1: `${TTable2}.${TKey2}`,
      operator: string,
      column2: `${TTable1}.${TKey1}`,
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
    onVal(column1: string, value: Value): JoinClause;
    onVal(column1: string, operator: string, value: Value): JoinClause;
    andOnVal(column1: string, value: Value): JoinClause;
    andOnVal(column1: string, operator: string, value: Value): JoinClause;
    orOnVal(column1: string, value: Value): JoinClause;
    orOnVal(column1: string, operator: string, value: Value): JoinClause;
    onIn(column1: string, values: readonly any[]): JoinClause;
    andOnIn(column1: string, values: readonly any[]): JoinClause;
    orOnIn(column1: string, values: readonly any[]): JoinClause;
    onNotIn(column1: string, values: readonly any[]): JoinClause;
    andOnNotIn(column1: string, values: readonly any[]): JoinClause;
    orOnNotIn(column1: string, values: readonly any[]): JoinClause;
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
    onBetween(column1: string, range: readonly [any, any]): JoinClause;
    andOnBetween(column1: string, range: readonly [any, any]): JoinClause;
    orOnBetween(column1: string, range: readonly [any, any]): JoinClause;
    onNotBetween(column1: string, range: readonly [any, any]): JoinClause;
    andOnNotBetween(column1: string, range: readonly [any, any]): JoinClause;
    orOnNotBetween(column1: string, range: readonly [any, any]): JoinClause;
    using(
      column: string | readonly string[] | Raw | { [key: string]: string | Raw }
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
    (alias: string, sql: string, bindings?: readonly Value[] | Object): QueryBuilder<
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

    (callback: QueryCallback<TRecord, TResult>): QueryBuilder<TRecord, TResult>;

    (object: DbRecord<ResolveTableType<TRecord>>): QueryBuilder<TRecord, TResult>;

    (object: Readonly<Object>): QueryBuilder<TRecord, TResult>;

    <T extends keyof ResolveTableType<TRecord>>(
      columnName: T,
      value: DbColumn<ResolveTableType<TRecord>[T]> | null
    ): QueryBuilder<TRecord, TResult>;

    (columnName: string, value: Value | null): QueryBuilder<TRecord, TResult>;

    <T extends keyof ResolveTableType<TRecord>>(
      columnName: T,
      operator: ComparisonOperator,
      value: DbColumn<ResolveTableType<TRecord>[T]> | null
    ): QueryBuilder<TRecord, TResult>;

    (columnName: string, operator: string, value: Value | null): QueryBuilder<
      TRecord,
      TResult
    >;

    <T extends keyof ResolveTableType<TRecord>, TRecordInner, TResultInner>(
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
    (callback: QueryCallback<TRecord, TResult>): QueryBuilder<TRecord, TResult>;
  }

  interface WhereNull<TRecord = any, TResult = unknown[]> {
    (columnName: keyof TRecord): QueryBuilder<TRecord, TResult>;
    (columnName: string): QueryBuilder<TRecord, TResult>;
  }

  interface WhereBetween<TRecord = any, TResult = unknown[]> {
    <K extends keyof TRecord>(
      columnName: K,
      range: readonly [DbColumn<TRecord[K]>, DbColumn<TRecord[K]>]
    ): QueryBuilder<TRecord, TResult>;
    (columnName: string, range: readonly [Value, Value]): QueryBuilder<TRecord, TResult>;
  }

  interface WhereExists<TRecord = any, TResult = unknown[]> {
    (callback: QueryCallback<TRecord, TResult>): QueryBuilder<TRecord, TResult>;
    <TRecordInner, TResultInner>(
      query: QueryBuilder<TRecordInner, TResultInner>
    ): QueryBuilder<TRecord, TResult>;
  }

  interface WhereIn<TRecord = any, TResult = unknown[]> {
    <K extends keyof ResolveTableType<TRecord>>(
      columnName: K,
      values: readonly DbColumn<ResolveTableType<TRecord>[K]>[] | QueryCallback
    ): QueryBuilder<TRecord, TResult>;
    (columnName: string, values: readonly Value[] | QueryCallback): QueryBuilder<
      TRecord,
      TResult
    >;
    <K extends keyof ResolveTableType<TRecord>>(
      columnNames: readonly K[],
      values: readonly (readonly DbColumn<ResolveTableType<TRecord>[K]>[])[] | QueryCallback
    ): QueryBuilder<TRecord, TResult>;
    (columnNames: readonly string[], values: readonly Value[][] | QueryCallback): QueryBuilder<
      TRecord,
      TResult
    >;
    <K extends keyof TRecord, TRecordInner, TResultInner>(
      columnName: K,
      values: QueryBuilder<TRecordInner, TRecord[K]>
    ): QueryBuilder<TRecord, TResult>;
    <TRecordInner, TResultInner>(
      columnName: string,
      values: Value[] | QueryBuilder<TRecordInner, TResultInner>
    ): QueryBuilder<TRecord, TResult>;
    <K extends keyof TRecord, TRecordInner, TResultInner>(
      columnNames: readonly K[],
      values: QueryBuilder<TRecordInner, TRecord[K]>
    ): QueryBuilder<TRecord, TResult>;
    <TRecordInner, TResultInner>(
      columnNames: readonly string[],
      values: QueryBuilder<TRecordInner, TResultInner>
    ): QueryBuilder<TRecord, TResult>;
  }

  // Note: Attempting to unify AsymmetricAggregation & TypePreservingAggregation
  // by extracting out a common base interface will not work because order of overloads
  // is significant.

  interface AsymmetricAggregation<TRecord = any, TResult = unknown[], TValue = any> {
    <
      TOptions extends { "as": string },
      TResult2 = AggregationQueryResult<TResult, {[k in TOptions["as"]]: TValue}>
    >(
      columnName: Readonly<keyof ResolveTableType<TRecord>>,
      options: Readonly<TOptions>
    ): QueryBuilder<TRecord, TResult2>;
    <TResult2 = AggregationQueryResult<TResult, Dict<TValue>>>(
      ...columnNames: readonly (keyof ResolveTableType<TRecord>)[]
    ): QueryBuilder<TRecord, TResult2>;
    <
      TAliases extends {} = Record<string, string | string[] | Knex.Raw>,
      TResult2 = AggregationQueryResult<TResult, {[k in keyof TAliases]?: TValue}>
    >(aliases: TAliases): QueryBuilder<TRecord, TResult2>;
    <TResult2 = AggregationQueryResult<TResult, Dict<TValue>>>(
      ...columnNames: ReadonlyArray<Readonly<Record<string, string | string[] | Knex.Raw>> | Knex.Raw | string>
    ): QueryBuilder<TRecord, TResult2>;
  }

  interface TypePreservingAggregation<TRecord = any, TResult = unknown[], TValue = any> {
    <
      TKey extends keyof ResolveTableType<TRecord>,
      TOptions extends { "as": string },
      TResult2 = AggregationQueryResult<TResult, {
        [k in TOptions["as"]]: ResolveTableType<TRecord>[TKey]
      }>
    >(
      columnName: Readonly<TKey>,
      options: Readonly<TOptions>
    ): QueryBuilder<TRecord, TResult2>;
    <
      TKey extends keyof ResolveTableType<TRecord>,
      TResult2 = AggregationQueryResult<TResult, Dict<ResolveTableType<TRecord>[TKey]>>
    >(
      ...columnNames: readonly TKey[]
    ): QueryBuilder<TRecord, TResult2>;
    <
      TAliases extends {} = Readonly<Record<string, string | string[] | Knex.Raw>>,
      TResult2 = AggregationQueryResult<TResult, {
        // We have optional here because in most dialects aggregating by multiple keys simultaneously
        // causes rest of the keys to be dropped and only first to be considered
        [K in keyof TAliases]?: K extends keyof TRecord ?
          TRecord[K] :
          TValue
      }>
    >(aliases: TAliases): QueryBuilder<TRecord, TResult2>;
    <TResult2 = AggregationQueryResult<TResult, Dict<TValue>>>(
      ...columnNames: ReadonlyArray<Readonly<Record<string, string | readonly string[] | Knex.Raw>> | Knex.Raw | string>
    ): QueryBuilder<TRecord, TResult2>;
  }

  interface AnalyticFunction<TRecord = any, TResult = unknown[]> {
    <TResult2 = AggregationQueryResult<TResult, Dict<number>>>(alias: string, raw: Raw | QueryCallback<TRecord, TResult>): QueryBuilder<TRecord, TResult2>;
    <TResult2 = AggregationQueryResult<TResult, Dict<number>>>(alias: string, orderBy: string | string[], partitionBy?: string | string[]): QueryBuilder<
      TRecord,
      TResult2
    >;
  }

  interface GroupBy<TRecord = any, TResult = unknown[]>
    extends RawQueryBuilder<TRecord, TResult>,
      ColumnNameQueryBuilder<TRecord, TResult> {}

  interface OrderBy<TRecord = any, TResult = unknown[]> {
    (columnName: keyof TRecord | QueryBuilder, order?: 'asc' | 'desc'): QueryBuilder<
      TRecord,
      TResult
    >;
    (columnName: string | QueryBuilder, order?: string): QueryBuilder<TRecord, TResult>;
    (
      columnDefs: Array<
        keyof TRecord | Readonly<{
          column: keyof TRecord | QueryBuilder;
          order?: 'asc' | 'desc'
        }>
      >
    ): QueryBuilder<TRecord, TResult>;
    (
      columnDefs: Array<string | Readonly<{
        column: string | QueryBuilder;
        order?: string;
      }>>
    ): QueryBuilder<TRecord, TResult>;
  }

  interface PartitionBy<TRecord = any, TResult = unknown[]>
    extends RawQueryBuilder<TRecord, TResult>,
      ColumnNameQueryBuilder<TRecord, TResult> {}

  interface Intersect<TRecord = any, TResult = unknown[]> {
    (
      callback: MaybeArray<QueryCallback | QueryBuilder<TRecord> | Raw>,
      wrap?: boolean
    ): QueryBuilder<TRecord, TResult>;
    (
      ...callbacks: readonly (QueryCallback | Raw | QueryBuilder<TRecord>)[]
    ): QueryBuilder<TRecord, TResult>;
  }

  interface Union<TRecord = any, TResult = unknown[]>
    extends Intersect<TRecord, TResult> {}

  interface Having<TRecord = any, TResult = unknown[]>
    extends WhereWrapped<TRecord, TResult> {
    <K extends keyof TRecord>(
      column: K,
      operator: ComparisonOperator,
      value: DbColumn<TRecord[K]>
    ): QueryBuilder<TRecord, TResult>;

    (
      column: string | Raw,
      operator: string,
      value: Value | QueryBuilder | null
    ): QueryBuilder<TRecord, TResult>;

    (raw: Raw): QueryBuilder<
      TRecord,
      TResult
    >;
  }

  interface HavingRange<TRecord = any, TResult = unknown[]> {
    <K extends keyof TRecord>(
      columnName: K,
      values: readonly DbColumn<TRecord[K]>[]
    ): QueryBuilder<TRecord, TResult>;
    (columnName: string, values: readonly Value[]): QueryBuilder<TRecord, TResult>;
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
      ColNameUT extends keyof ResolveTableType<TRecord>,
      TResult2 = DeferredKeySelection.Augment<
        UnwrapArrayMember<TResult>,
        ResolveTableType<TRecord>,
        ColNameUT & string
      >[]
    >(
      ...columnNames: readonly ColNameUT[]
    ): QueryBuilder<TRecord, TResult2>;

    <
      ColNameUT extends keyof ResolveTableType<TRecord>,
      TResult2 = DeferredKeySelection.Augment<
        UnwrapArrayMember<TResult>,
        ResolveTableType<TRecord>,
        ColNameUT & string
      >[]
    >(
      columnNames: readonly ColNameUT[]
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
      ...columnNames: readonly ColumnDescriptor<TRecord, TResult>[]
    ): QueryBuilder<TRecord, TResult2>;

    <
      TResult2 = DeferredKeySelection.Augment<
        UnwrapArrayMember<TResult>,
        SafePartial<TRecord>,
        keyof TRecord & string
      >[]
    >(
      columnNames: readonly ColumnDescriptor<TRecord, TResult>[]
    ): QueryBuilder<TRecord, TResult2>;
  }

  type RawBinding = Value | QueryBuilder;

  interface RawQueryBuilder<TRecord = any, TResult = unknown[]> {
    <TResult2 = TResult>(
      sql: string,
      bindings?: readonly RawBinding[] | ValueDict | RawBinding
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
    timeout(ms: number, options?: {cancel?: boolean}): Raw<TResult>;
    wrap<TResult2 = TResult>(before: string, after: string): Raw<TResult>;
    toSQL(): Sql;
    queryContext(context: any): Raw<TResult>;
    queryContext(): any;
  }

  interface RawBuilder<TRecord extends {} = any, TResult = any> {
    <TResult2 = TResult>(value: Value): Raw<TResult2>;
    <TResult2 = TResult>(sql: string, ...bindings: readonly RawBinding[]): Raw<TResult2>;
    <TResult2 = TResult>(sql: string, bindings: readonly RawBinding[] | ValueDict): Raw<TResult2>;
  }

  const RefMemberTag: unique symbol;

  interface Ref<TSrc extends string, TMapping extends {}> extends Raw<string> {
      // TypeScript can behave weirdly if type parameters are not
      // actually used in the members of type.
      //
      // See: https://github.com/knex/knex/issues/3932
      //
      // We simply need to propagate the type context so that we can extract
      // them later, but we just add a "phantom" property so that typescript
      // doesn't think that these parameters are unused
      //
      // Because unique symbol is used here, there is no way to actually
      // access this at runtime
      [RefMemberTag]: {
        src: TSrc,
        mapping: TMapping
      };
      withSchema(schema: string): this;
      as<TAlias extends string>(alias: TAlias): Ref<TSrc, {[K in TAlias]: TSrc}>;
  }

  interface RefBuilder {
      <TSrc extends string>(src: TSrc): Ref<TSrc, {[K in TSrc]: TSrc}>;
  }

  interface BatchInsertBuilder<TRecord extends {} = any, TResult = number[]> extends Promise<ResolveResult<TResult>> {
    transacting(trx: Transaction): this;
    // see returning methods from QueryInterface
    returning(column: '*'): BatchInsertBuilder<TRecord, DeferredKeySelection<TRecord, never>[]>;
    returning<
      TKey extends StrKey<ResolveTableType<TRecord>>,
      TResult2 = DeferredIndex.Augment<
        UnwrapArrayMember<TResult>,
        ResolveTableType<TRecord>,
        TKey
        >[]
      >(
        column: TKey
    ): BatchInsertBuilder<TRecord, TResult2>;
    returning<
      TKey extends StrKey<ResolveTableType<TRecord>>,
      TResult2 = DeferredKeySelection.SetSingle<
        DeferredKeySelection.Augment<UnwrapArrayMember<TResult>, ResolveTableType<TRecord>, TKey>,
        false
        >[]
      >(
        columns: readonly TKey[]
    ): BatchInsertBuilder<TRecord, TResult2>;
    // if data with specific type passed, exclude this method
    returning<TResult2 = SafePartial<TRecord>[]>(
      column: unknown extends TRecord ? string | readonly string[] : never
    ): BatchInsertBuilder<TRecord, TResult2>;
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
    forUpdate(tableNames: readonly string[]): QueryBuilder<TRecord, TResult>;

    forShare(...tableNames: string[]): QueryBuilder<TRecord, TResult>;
    forShare(tableNames: readonly string[]): QueryBuilder<TRecord, TResult>;

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
    bindings: readonly Value[];
    sql: string;
    toNative(): SqlNative;
  }

  interface SqlNative {
    bindings: readonly Value[];
    sql: string;
  }

  //
  // Chainable interface
  //

  type ExposedPromiseKeys =
    | "then"
    | "catch"
    | "finally";

  interface StringTagSupport {
    readonly [Symbol.toStringTag]: string;
  }
  interface ChainableInterface<T = any> extends Pick<Promise<T>, keyof Promise<T> & ExposedPromiseKeys>, StringTagSupport {
    generateDdlCommands(): Promise<{ pre: string[], sql: string[], post: string[] }>;
    toQuery(): string;
    options(options: Readonly<{ [key: string]: any }>): this;
    connection(connection: any): this;
    debug(enabled: boolean): this;
    transacting(trx: Transaction): this;
    stream(handler: (readable: stream.PassThrough) => any): Promise<any>;
    stream(
      options: Readonly<{ [key: string]: any }>,
      handler: (readable: stream.PassThrough) => any
    ): Promise<any>;
    stream(options?: Readonly<{ [key: string]: any }>): stream.PassThrough & AsyncIterable<ArrayMember<T>>;
    pipe<T extends NodeJS.WritableStream>(
      writable: T,
      options?: Readonly<{ [key: string]: any }>
    ): stream.PassThrough;
    asCallback(callback: Function): Promise<T>;
  }

  // Not all of these are possible for all drivers, notably, sqlite doesn't support any of these
  type IsolationLevels = 'read uncommitted' | 'read committed' | 'snapshot' | 'repeatable read' | 'serializable';
  interface TransactionConfig {
    isolationLevel?: IsolationLevels;
    userParams?: Record<string, any>;
    doNotRejectOnRollback?: boolean;
    connection?: any;
  }

  interface Transaction<TRecord extends {} = any, TResult = any[]>
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

  type TransactionProvider = () => Promise<Transaction>;

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
    toString(): string;
    toSQL(): Sql;
  }

  interface TableBuilder {
    increments(
      columnName?: string,
      options?: { primaryKey?: boolean }
    ): ColumnBuilder;
    bigIncrements(
      columnName?: string,
      options?: { primaryKey?: boolean }
    ): ColumnBuilder;
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
    double(
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
    dateTime(columnName: string, options?: Readonly<{useTz?: boolean, precision?: number}>): ColumnBuilder;
    time(columnName: string): ColumnBuilder;
    timestamp(columnName: string, options?: Readonly<{useTz?: boolean, precision?: number}>): ColumnBuilder;
    /** @deprecated */
    timestamp(columnName: string, withoutTz?: boolean, precision?: number): ColumnBuilder;
    timestamps(
      useTimestampType?: boolean,
      makeDefaultNow?: boolean
    ): ColumnBuilder;
    binary(columnName: string, length?: number): ColumnBuilder;
    enum(
      columnName: string,
      values: readonly Value[],
      options?: EnumOptions
    ): ColumnBuilder;
    enu(
      columnName: string,
      values: readonly Value[],
      options?: EnumOptions
    ): ColumnBuilder;
    json(columnName: string): ColumnBuilder;
    jsonb(columnName: string): ColumnBuilder;
    uuid(columnName: string): ColumnBuilder;
    comment(val: string): TableBuilder;
    specificType(columnName: string, type: string): ColumnBuilder;
    primary(columnNames: readonly string[], constraintName?: string): TableBuilder;
    index(
      columnNames: string | readonly (string | Raw)[],
      indexName?: string,
      indexType?: string
    ): TableBuilder;
    unique(columnNames: readonly (string | Raw)[], indexName?: string): TableBuilder;
    foreign(column: string, foreignKeyName?: string): ForeignConstraintBuilder;
    foreign(
      columns: readonly string[],
      foreignKeyName?: string
    ): MultikeyForeignConstraintBuilder;
    dropForeign(columnNames: string | readonly string[], foreignKeyName?: string): TableBuilder;
    dropUnique(columnNames: readonly (string | Raw)[], indexName?: string): TableBuilder;
    dropPrimary(constraintName?: string): TableBuilder;
    dropIndex(columnNames: string | readonly (string | Raw)[], indexName?: string): TableBuilder;
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
    defaultTo(value: Value | null, options?: DefaultToOptions): ColumnBuilder;
    unsigned(): ColumnBuilder;
    notNullable(): ColumnBuilder;
    nullable(): ColumnBuilder;
    comment(value: string): ColumnBuilder;
    alter(): ColumnBuilder;
    queryContext(context: any): ColumnBuilder;
    withKeyName(keyName: string): ColumnBuilder;
    after(columnName: string): ColumnBuilder;
    first(): ColumnBuilder;
  }

  interface ForeignConstraintBuilder {
    references(columnName: string): ReferencingColumnBuilder;
  }

  interface MultikeyForeignConstraintBuilder {
    references(columnNames: readonly string[]): ReferencingColumnBuilder;
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
    seeds?: SeederConfig<SV>;
    acquireConnectionTimeout?: number;
    useNullAsDefault?: boolean;
    searchPath?: string | readonly string[];
    asyncStackTraces?: boolean;
    log?: Logger;
  }

  type StaticConnectionConfig =
    | ConnectionConfig
    | MariaSqlConnectionConfig
    | MySqlConnectionConfig
    | MySql2ConnectionConfig
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

  type MsSqlAuthenticationTypeOptions =
    | 'default'
    | 'ntlm'
    | 'azure-active-directory-password'
    | 'azure-active-directory-access-token'
    | 'azure-active-directory-msi-vm'
    | 'azure-active-directory-msi-app-service'
    | 'azure-active-directory-service-principal-secret';

interface MsSqlDefaultAuthenticationConfig extends MsSqlConnectionConfigBase {
  type?: 'default' | never;
}

interface MsSqlAzureActiveDirectoryMsiAppServiceAuthenticationConfig
  extends MsSqlConnectionConfigBase {
  type: 'azure-active-directory-msi-app-service';
  /**
   * If you user want to connect to an Azure app service using a specific client account
   * they need to provide `clientId` asscoiate to their created idnetity.
   *
   * This is optional for retrieve token from azure web app service
   */
  clientId?: string;
  /**
   * A msi app service environment need to provide `msiEndpoint` for retriving the accesstoken.
   */
  msiEndpoint?: string;
  /**
   * A msi app service environment need to provide `msiSecret` for retriving the accesstoken.
   */
  msiSecret?: string;
}

interface MsSqlAzureActiveDirectoryMsiVmAuthenticationConfig
  extends MsSqlConnectionConfigBase {
  type: 'azure-active-directory-msi-vm';
  /**
   * If you user want to connect to an Azure app service using a specific client account
   * they need to provide `clientId` asscoiate to their created idnetity.
   *
   * This is optional for retrieve token from azure web app service
   */
  clientId?: string;
  /**
   * A user need to provide `msiEndpoint` for retriving the accesstoken.
   */
  msiEndpoint?: string;
}

interface MsSqlAzureActiveDirectoryAccessTokenAuthenticationConfig
  extends MsSqlConnectionConfigBase {
  type: 'azure-active-directory-access-token';
  /**
   * A user-provided access token
   */
  token: string;
}
interface MsSqlAzureActiveDirectoryPasswordAuthenticationConfig
  extends MsSqlConnectionConfigBase {
  type: 'azure-active-directory-password';
  /**
   * Optional parameter for specific Azure tenant ID
   */
  domain: string;
  userName: string;
  password: string;
}

interface MsSqlAzureActiveDirectoryServicePrincipalSecretConfig
  extends MsSqlConnectionConfigBase {
  type: 'azure-active-directory-service-principal-secret';
  /**
   * Application (`client`) ID from your registered Azure application
   */
  clientId: string;
  /**
   * The created `client secret` for this registered Azure application
   */
  clientSecret: string;
  /**
   * Directory (`tenant`) ID from your registered Azure application
   */
  tenantId: string;
}

interface MsSqlNtlmAuthenticationConfig extends MsSqlConnectionConfigBase {
  type: 'ntlm';
  /**
   * Once you set domain for ntlm authentication type, driver will connect to SQL Server using domain login.
   *
   * This is necessary for forming a connection using ntlm type
   */
  domain: string;
  userName: string;
  password: string;
}

type MsSqlConnectionConfig =
  | MsSqlDefaultAuthenticationConfig
  | MsSqlNtlmAuthenticationConfig
  | MsSqlAzureActiveDirectoryAccessTokenAuthenticationConfig
  | MsSqlAzureActiveDirectoryMsiAppServiceAuthenticationConfig
  | MsSqlAzureActiveDirectoryMsiVmAuthenticationConfig
  | MsSqlAzureActiveDirectoryPasswordAuthenticationConfig
  | MsSqlAzureActiveDirectoryServicePrincipalSecretConfig;

  // Config object for tedious: see http://tediousjs.github.io/tedious/api-connection.html
interface MsSqlConnectionConfigBase {
    type?: MsSqlAuthenticationTypeOptions;

    driver?: string;
    userName?: string; // equivalent to knex "user"
    password?: string;
    server: string; // equivalent to knex "host"
    port?: number;
    domain?: string;
    database: string;
    connectionTimeout?: number;
    requestTimeout?: number;
    stream?: boolean;
    parseJSON?: boolean;
    expirationChecker?(): boolean;
    options?: Readonly<{
      encrypt?: boolean;
      instanceName?: string;
      useUTC?: boolean;
      tdsVersion?: string;
      appName?: string;
      abortTransactionOnError?: boolean;
      trustedConnection?: boolean;
      enableArithAbort?: boolean;
      isolationLevel?: 'READ_UNCOMMITTED' | 'READ_COMMITTED' | 'REPEATABLE_READ' | 'SERIALIZABLE' | 'SNAPSHOT';
      maxRetriesOnTransientErrors?: number;
      multiSubnetFailover?: boolean;
      packetSize?: number;
    }>;
    pool?: Readonly<{
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
    }>;
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

  // Config object for mysql2: https://github.com/sidorares/node-mysql2/blob/master/lib/connection_config.js
  // Some options for connection pooling and MySQL server API are excluded.
  interface MySql2ConnectionConfig extends MySqlConnectionConfig {
    authPlugins?: {[pluginName: string]: (pluginMetadata: any) => ((pluginData: any) => any)};
    authSwitchHandler?: (data: any, callback: () => void) => any;
    charsetNumber?: number;
    compress?: boolean;
    connectAttributes?: {[attrNames: string]: any};
    enableKeepAlive?: boolean;
    keepAliveInitialDelay?: number;
    maxPreparedStatements?: number;
    namedPlaceholders?: boolean;
    nestTables?: boolean | string;
    passwordSha1?: string;
    rowsAsArray?: boolean;
    stream?: boolean | ((opts: any) => Stream) | Stream;
    uri?: string;
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
    application_name?: string;
  }

  type RedshiftConnectionConfig = PgConnectionConfig;

  /** Used with SQLite3 adapter */
  interface Sqlite3ConnectionConfig {
    filename: string;
    flags?: string[];
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

    // tarn configs
    propagateCreateError?: boolean;
    createRetryIntervalMillis?: number;
    createTimeoutMillis?: number;
    destroyTimeoutMillis?: number;
    acquireTimeoutMillis?: number;
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

  interface Migration {
      up: (knex: Knex) => PromiseLike<any>;
      down?: (kenx: Knex) => PromiseLike<any>;
  }

  interface MigrationSource<TMigrationSpec> {
      getMigrations(loadExtensions: readonly string[]): Promise<TMigrationSpec[]>;
      getMigrationName(migration: TMigrationSpec): string;
      getMigration(migration: TMigrationSpec): Migration;
  }

  interface MigratorConfig {
    database?: string;
    directory?: string | readonly string[];
    extension?: string;
    stub?: string;
    tableName?: string;
    schemaName?: string;
    disableTransactions?: boolean;
    disableMigrationsListValidation?: boolean;
    sortDirsSeparately?: boolean;
    loadExtensions?: readonly string[];
    migrationSource?: MigrationSource<unknown>;
    name?: string;
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

  interface SeederConfig<V extends {} = any> {
    extension?: string;
    directory?: string | readonly string[];
    loadExtensions?: readonly string[];
    specific?: string;
    timestampFilenamePrefix?: boolean;
    recursive?: boolean;
    sortDirsSeparately?: boolean;
    stub?: string;
    variables?: V;
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

  interface DefaultToOptions {
    // only supported by mssql driver
    constraintName?: string;
  }

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
}

export default knex;
