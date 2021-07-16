import { knex, Knex } from 'knex';
import { PassThrough } from 'stream';

////////////////////////////////////////////////////////////////////////////////////////
//                                                                                    //
// dtslint tests are deprecated, please add new tests for tsd instead (see /test-tsd) //
//                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////

const clientConfig = {
  client: 'sqlite3',
  connection: {
    filename: './mydb.sqlite',
  },
};

const knexInstance = knex(clientConfig);

const knex2 = knex({
    ...clientConfig,
    log: {
        debug(msg: string) {}
    },
    pool: {
      log: (msg: string, level: string) => {}
    }
});

knexInstance.initialize();
knexInstance.initialize({});

interface User {
  id: number;
  age: number;
  name: string;
  active: boolean;
  departmentId: number;
}

interface Department {
  id: number;
  departmentName: string;
}

interface Article {
  id: number;
  subject: string;
  body?: string;
  authorId?: string;
}

interface Ticket {
  name: string;
  from: string;
  to: string;
  at: Date;
}

// Interface to witness type compatibility
interface ExtendsWitness<T1 extends T2, T2> {
  _t: T1;
}

// Ensure that Knex type with parameters is compatible with Knex with default parameters
//
// This ensures that a value of Parameterized Knex can always be passed to a function that
// consumes unparameterized Knex.
type _T1 = ExtendsWitness<Knex<User>, Knex>;
type _T2 = ExtendsWitness<Knex<User, Partial<User>[]>, Knex>;
type _T3 = ExtendsWitness<Knex.Where<User, Partial<User>[]>, Knex.Where>;
type _T4 = ExtendsWitness<Knex.Where<User, number>, Knex.Where>;
type _T5 = ExtendsWitness<
  Knex.QueryInterface<User, Partial<User[]>>,
  Knex.QueryInterface
>;
type _T6 = ExtendsWitness<Knex.QueryBuilder<User, User[]>, Knex.QueryBuilder>;
type _T7 = ExtendsWitness<
  Knex.QueryBuilder<User, User[]>,
  Knex.QueryBuilder<any, any[]>
>;
type _T8 = ExtendsWitness<Knex.QueryBuilder<User, number[]>, Knex.QueryBuilder>;
type _T9 = ExtendsWitness<Knex.QueryBuilder<any, any[]>, Knex.QueryBuilder>;
type _T10 = ExtendsWitness<Knex.QueryBuilder<User, number>, Knex.QueryBuilder>;

declare module './tables' {
  interface Tables {
    users_inferred: User;
    departments_inferred: Department;
    articles_inferred: Article;
    users_composite: Knex.CompositeTableType<User, { insert: 'insert' }, { update: 'update' }>;
    departments_composite: Knex.CompositeTableType<Department, { insert: 'insert' }, { update: 'update' }>;
    articles_composite: Knex.CompositeTableType<Article, { insert: 'insert' }, { update: 'update' }>;
  }
}

const main = async () => {
  // $ExpectType any
  await knexInstance.raw('select * from users');

  // $ExpectType User[]
  await knexInstance.raw<User[]>('select * from users');

  // $ExpectType any
  await knexInstance.raw(
      'select * from users where id in ?',
      knexInstance('contacts').select('name')
  );

  // $ExpectType User[]
  await knexInstance.raw<User[]>(
      'select * from users where id in ?',
      knexInstance('contacts').select('name')
  );

  // $ExpectType User[]
  await knexInstance.raw<User[]>(
      'select * from users where departmentId in ?',
      knexInstance<Department>('departments').select('id')
  );

  // $ExpectType User[]
  await knexInstance.raw<User[]>(
      'select * from users where departmentId in ? & active in ?',
      [
          knexInstance<Department>('departments').select('name'),
          [true, false]
      ]
  );

  // $ExpectType Article[]
  await knexInstance.raw<Article[]>(
      'select * from articles where authorId = ?',
      [ null ]
  );

  // $ExpectType PassThrough & AsyncIterable<User>
  knexInstance<User>('users').select('*').stream();

  // $ExpectType PassThrough
  knexInstance<User>('users').select('*').stream().pipe(new PassThrough());

  // $ExpectType User[]
  await knexInstance<User>('user').where('name', ['a', 'b', 'c']);

  // $ExpectType User[]
  await knexInstance('users_inferred').where('name', ['a', 'b', 'c']);

  // $ExpectType User[]
  await knexInstance('users_composite').where('name', ['a', 'b', 'c']);

  // $ExpectType User[]
  await knexInstance<User>('user').whereRaw('name = ?', 'L');

  // $ExpectType User[]
  await knexInstance('users_inferred').whereRaw('name = ?', 'L');

  // $ExpectType User[]
  await knexInstance('users_composite').whereRaw('name = ?', 'L');

  // $ExpectType User[]
  await knexInstance<User>('user').whereRaw('name = ?', 'L').clearWhere();

  // $ExpectType User[]
  await knexInstance('users_inferred').whereRaw('name = ?', 'L').clearWhere();

  // $ExpectType User[]
  await knexInstance('users_composite').whereRaw('name = ?', 'L').clearWhere();

  // $ExpectType User[]
  await knexInstance<User>('user').whereBetween("id", [1, 2]);

  // $ExpectType User[]
  await knexInstance('users_inferred').whereBetween('id', [1, 2]);

  // $ExpectType User[]
  await knexInstance('users_composite').whereBetween('id', [1, 2]);

  const range = [1, 2] as const;
  // $ExpectType User[]
  await knexInstance<User>('user').whereBetween("id", range);

  // $ExpectType User[]
  await knexInstance('users_inferred').whereBetween('id', range);

  // $ExpectType User[]
  await knexInstance('users_composite').whereBetween('id', range);

  // $ExpectType { id: number; }[]
  const r3 = await knexInstance<User>('users').select(knexInstance.ref('id'));

  // $ExpectType { id: number; }[]
  await knexInstance('users_inferred').select(knexInstance.ref('id'));

  // $ExpectType { id: number; }[]
  await knexInstance('users_composite').select(knexInstance.ref('id'));

  // $ExpectType (Pick<User, "name"> & { id: number; })[]
  const r4 = await knexInstance<User>('users').select(knexInstance.ref('id'), 'name');
  type _TR4 = ExtendsWitness<typeof r4[0], Pick<User, "id" | "name">>;

  // $ExpectType (Pick<User, "name"> & { id: number; })[]
  await knexInstance('users_inferred').select(knexInstance.ref('id'), 'name');

  // $ExpectType (Pick<User, "name"> & { id: number; })[]
  await knexInstance('users_composite').select(knexInstance.ref('id'), 'name');

  // $ExpectType (Pick<User, "name"> & { identifier: number; })[]
  const r5 = await knexInstance<User>('users').select(knexInstance.ref('id').as('identifier'), 'name');
  type _TR5 = ExtendsWitness<typeof r5[0], {identifier: number; name: string}>;

  // $ExpectType (Pick<User, "name"> & { identifier: number; })[]
  await knexInstance('users_inferred').select(knexInstance.ref('id').as('identifier'), 'name');

  // $ExpectType (Pick<User, "name"> & { identifier: number; })[]
  await knexInstance('users_composite').select(knexInstance.ref('id').as('identifier'), 'name');

  // $ExpectType (Pick<User, "name"> & { identifier: number; yearsSinceBirth: number; })[]
  const r6 = await knexInstance<User>('users').select(
      knexInstance.ref('id').as('identifier'),
      'name',
      knexInstance.ref('age').as('yearsSinceBirth')
  );
  type _TR6 = ExtendsWitness<typeof r6[0], {identifier: number; name: string; yearsSinceBirth: number}>;
  // $ExpectType (Pick<User, "name"> & { identifier: number; yearsSinceBirth: number; })[]
  await knexInstance('users_inferred').select(
      knexInstance.ref('id').as('identifier'),
      'name',
      knexInstance.ref('age').as('yearsSinceBirth')
  );
  // $ExpectType (Pick<User, "name"> & { identifier: number; yearsSinceBirth: number; })[]
  await knexInstance('users_composite').select(
      knexInstance.ref('id').as('identifier'),
      'name',
      knexInstance.ref('age').as('yearsSinceBirth')
  );

  // $ExpectType { id: number; }[]
  const r7 = await knexInstance.select(knexInstance.ref('id')).from<User>('users');
  type _TR7 = ExtendsWitness<typeof r7[0], Pick<User, "id">>;

  // $ExpectType { id: number; }[]
  await knexInstance.select(knexInstance.ref('id')).from('users_inferred');

  // $ExpectType { id: number; }[]
  await knexInstance.select(knexInstance.ref('id')).from('users_composite');

  // $ExpectType (Pick<User, "name"> & { id: number; })[]
  const r8 = await knexInstance.select(knexInstance.ref('id'), 'name').from<User>('users');
  type _TR8 = ExtendsWitness<typeof r8[0], Pick<User, "id" | "name">>;

  // $ExpectType (Pick<User, "name"> & { id: number; })[]
  await knexInstance.select(knexInstance.ref('id'), 'name').from('users_inferred');

  // $ExpectType (Pick<User, "name"> & { id: number; })[]
  await knexInstance.select(knexInstance.ref('id'), 'name').from('users_composite');

  // $ExpectType (Pick<User, "name"> & { identifier: number; })[]
  const r9 = await knexInstance.select(knexInstance.ref('id').as('identifier'), 'name').from<User>('users');
  type _TR9 = ExtendsWitness<typeof r9[0], {identifier: number; name: string}>;

  // $ExpectType (Pick<User, "name"> & { identifier: number; })[]
  await knexInstance.select(knexInstance.ref('id').as('identifier'), 'name').from('users_inferred');

  // $ExpectType (Pick<User, "name"> & { identifier: number; })[]
  await knexInstance.select(knexInstance.ref('id').as('identifier'), 'name').from('users_composite');

  // $ExpectType (Pick<User, "name"> & { identifier: number; yearsSinceBirth: number; })[]
  const r10 = await knexInstance.select(
      knexInstance.ref('id').as('identifier'),
      'name',
      knexInstance.ref('age').as('yearsSinceBirth')
  ).from<User>('users');
  type _TR10 = ExtendsWitness<typeof r10[0], {identifier: number; name: string; yearsSinceBirth: number}>;

  // $ExpectType (Pick<User, "name"> & { identifier: number; yearsSinceBirth: number; })[]
  await knexInstance.select(
    knexInstance.ref('id').as('identifier'),
    'name',
    knexInstance.ref('age').as('yearsSinceBirth')
  ).from('users_inferred');

  // $ExpectType (Pick<User, "name"> & { identifier: number; yearsSinceBirth: number; })[]
  await knexInstance.select(
    knexInstance.ref('id').as('identifier'),
    'name',
    knexInstance.ref('age').as('yearsSinceBirth')
  ).from('users_composite');

  // $ExpectType { id: number; age: any; }[]
  await knexInstance<User>('users').select(knexInstance.ref('id'), {age: 'users.age'});

  // $ExpectType { id: number; age: any; }[]
  await knexInstance('users_inferred').select(knexInstance.ref('id'), {age: 'users.age'});

  // $ExpectType { id: number; age: any; }[]
  await knexInstance('users_composite').select(knexInstance.ref('id'), {age: 'users.age'});

  // $ExpectType { id: number; age: any; } | undefined
  await knexInstance<User>('users').select(knexInstance.ref('id'), {age: 'users.age'}).first();

  // $ExpectType { id: number; age: any; } | undefined
  await knexInstance('users_inferred').select(knexInstance.ref('id'), {age: 'users.age'}).first();

  // $ExpectType { id: number; age: any; } | undefined
  await knexInstance('users_composite').select(knexInstance.ref('id'), {age: 'users.age'}).first();

  // $ExpectType { identifier: number; username: string; }[]
  (await knexInstance<User>('users')
    .select('id', 'name'))
    .map((u) => ({ identifier: u.id, username: u.name }));

  // $ExpectType { identifier: number; username: string; }[]
  (await knexInstance('users_inferred')
    .select('id', 'name'))
    .map((u) => ({ identifier: u.id, username: u.name }));

  // $ExpectType { identifier: number; username: string; }[]
  (await knexInstance('users_composite')
    .select('id', 'name'))
    .map((u) => ({ identifier: u.id, username: u.name }));

  // $ExpectType { identifier: number; username: string; }[]
  (await knexInstance
    .select('id', 'name')
    .from<User>('users'))
    .map((u) => ({ identifier: u.id, username: u.name }));

  // $ExpectType { identifier: number; username: string; }[]
  (await knexInstance
    .select('id', 'name')
    .from('users_inferred'))
    .map((u) => ({ identifier: u.id, username: u.name }));

  // $ExpectType { identifier: number; username: string; }[]
  (await knexInstance
    .select('id', 'name')
    .from('users_composite'))
    .map((u) => ({ identifier: u.id, username: u.name }));

  // $ExpectType { identifier: any; username: any; }[]
  (await knexInstance
    .select('id', 'name')
    .from('users'))
    .map((u) => ({ identifier: u.id, username: u.name }));

  // $ExpectType number
  (await knexInstance
    .select('id', 'name', 'age')
    .from<User>('users'))
    .reduce((maxAge: number, user) => (user.age > maxAge ? user.age : maxAge), 0);

  // $ExpectType number
  (await knexInstance
    .select('id', 'name', 'age')
    .from('users_inferred'))
    .reduce((maxAge: number, user) => (user.age > maxAge ? user.age : maxAge), 0);

  // $ExpectType number
  (await knexInstance
    .select('id', 'name', 'age')
    .from('users_composite'))
    .reduce((maxAge: number, user) => (user.age > maxAge ? user.age : maxAge), 0);

  // $ExpectType any
  (await knexInstance('table')
    .select('key', 'value')
    .where({ namespace: 'foo' }))
    .reduce(
      (aggr, { value, key }) => ({
        ...aggr,
        [key]: value > 10 ? (aggr[key] || 0) + 1 : aggr[key],
      }),
      {} as any
    );

  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance<User>('users').select(['id', 'age']);

  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance('users_inferred').select(['id', 'age']);

  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance('users_composite').select(['id', 'age']);

  // $ExpectType Pick<User, "id" | "age"> | undefined
  await knexInstance<User>('users')
    .select(['id', 'age'])
    .first();

  // $ExpectType Pick<User, "id" | "age"> | undefined
  await knexInstance('users_inferred')
    .select(['id', 'age'])
    .first();

  // $ExpectType Pick<User, "id" | "age"> | undefined
  await knexInstance('users_composite')
    .select(['id', 'age'])
    .first();

  // $ExpectType any[]
  await knexInstance<User>('users').select('users.id');

  // $ExpectType Pick<User, "name">[]
  await knexInstance<User>('users')
    .select(['id', 'age'])
    .clearSelect()
    .select(['name']);

  // $ExpectType Pick<User, "name">[]
  await knexInstance('users_inferred')
    .select(['id', 'age'])
    .clearSelect()
    .select(['name']);

  // $ExpectType Pick<User, "name">[]
  await knexInstance('users_composite')
    .select(['id', 'age'])
    .clearSelect()
    .select(['name']);

  // $ExpectType Pick<User, "name" | "departmentId">[]
  await knexInstance<User>('users')
    .select('id')
    .select('age')
    .clearSelect()
    .select('name')
    .select('departmentId');

  // $ExpectType Pick<User, "name" | "departmentId">[]
  await knexInstance('users_inferred')
    .select('id')
    .select('age')
    .clearSelect()
    .select('name')
    .select('departmentId');

  // $ExpectType Pick<User, "name" | "departmentId">[]
  await knexInstance('users_composite')
    .select('id')
    .select('age')
    .clearSelect()
    .select('name')
    .select('departmentId');

  // $ExpectType Pick<User, "name" | "departmentId">[]
  await knexInstance
    .select('id')
    .select('age')
    .clearSelect()
    .select('name')
    .select('departmentId')
    .from<User>('users');

  // $ExpectType Pick<User, "name" | "departmentId">[]
  await knexInstance
    .select('id')
    .select('age')
    .clearSelect()
    .select('name')
    .select('departmentId')
    .from('users_inferred');

  // $ExpectType Pick<User, "name" | "departmentId">[]
  await knexInstance
    .select('id')
    .select('age')
    .clearSelect()
    .select('name')
    .select('departmentId')
    .from('users_composite');

  // $ExpectType any[]
  await knexInstance<User>('users')
    .select('users.id')
    .select('age');

  // $ExpectType any[]
  await knexInstance<User>('users')
    .select('id')
    .from('departments');

  // $ExpectType Pick<Department, "id">[]
  await knexInstance<User>('users')
    .select('id')
    .from<Department>('departments');

  // $ExpectType Pick<Department, "id">[]
  await knexInstance('users_inferred')
    .select('id')
    .from('departments_inferred');

  // $ExpectType Pick<Department, "id">[]
  await knexInstance('users_composite')
    .select('id')
    .from('departments_composite');

  // $ExpectType any[]
  await knexInstance.select('id').from('users');

  // $ExpectType Pick<User, "id">[]
  await knexInstance.select('id').from<User>('users');

  // $ExpectType Pick<User, "id">[]
  await knexInstance.select('id').from('users_inferred');

  // $ExpectType Pick<User, "id">[]
  await knexInstance.select('id').from('users_composite');

  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance.select('id', 'age').from<User>('users');

  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance.select('id', 'age').from('users_inferred');

  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance.select('id', 'age').from('users_composite');

  // $ExpectType Pick<User, "id">[]
  await knexInstance.from<User>('users').select('id');

  // $ExpectType Pick<User, "id">[]
  await knexInstance.from('users_inferred').select('id');

  // $ExpectType Pick<User, "id">[]
  await knexInstance.from('users_composite').select('id');

  // $ExpectType any[]
  await knexInstance.from<User>('users').select('users.id');

  // $ExpectType Pick<User, "id">[]
  await knexInstance.from<User>('users').select<Pick<User, 'id'>[]>('users.id');

  // $ExpectType any[]
  await knexInstance
    .column('id', 'age')
    .select()
    .from('users');

  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance
    .column('id', 'age')
    .select()
    .from<User>('users');

  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance
    .column('id', 'age')
    .select()
    .from('users_inferred');

  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance
    .column('id', 'age')
    .select()
    .from('users_composite');

  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance<User>('users')
    .column('id', 'age')
    .select();

  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance('users_inferred')
    .column('id', 'age')
    .select();

  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance('users_composite')
    .column('id', 'age')
    .select();

  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance<User>('users').column('id', 'age');

  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance('users_inferred').column('id', 'age');

  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance('users_composite').column('id', 'age');

  // $ExpectType any[]
  await knexInstance('users').distinct('name', 'age');

  // $ExpectType Pick<User, "name" | "age">[]
  await knexInstance<User>('users').distinct('name', 'age');

  // $ExpectType Pick<User, "name" | "age">[]
  await knexInstance('users_inferred').distinct('name', 'age');

  // $ExpectType Pick<User, "name" | "age">[]
  await knexInstance('users_composite').distinct('name', 'age');

  // $ExpectType Pick<User, "name" | "id" | "age" | "active" | "departmentId">[]
  await knexInstance<User>('users').distinct();

  // $ExpectType Pick<User, "name" | "id" | "age" | "active" | "departmentId">[]
  await knexInstance('users_inferred').distinct();

  // $ExpectType Pick<User, "name" | "id" | "age" | "active" | "departmentId">[]
  await knexInstance('users_composite').distinct();

  // $ExpectType User[]
  await knexInstance.select('*').from<User>('users');

  // $ExpectType User[]
  await knexInstance.select('*').from('users_inferred');

  // $ExpectType User[]
  await knexInstance.select('*').from('users_composite');

  const r1 = await knexInstance
    .column('id', { yearsSinceBirth: 'age' })
    .select()
    .from<User>('users');

  type TR1_1 = ExtendsWitness<
    { id: number; yearsSinceBirth: any },
    typeof r1[0]
  >;
  type TR1_2 = ExtendsWitness<number, typeof r1[0]['id']>;
  type TR1_3 = ExtendsWitness<any, typeof r1[0]['yearsSinceBirth']>;

  // $ExpectType (Pick<User, "id"> & { yearsSinceBirth: any; })[]
  await knexInstance
    .column('id', { yearsSinceBirth: 'age' })
    .select()
    .from('users_inferred');

  // $ExpectType (Pick<User, "id"> & { yearsSinceBirth: any; })[]
  await knexInstance
    .column('id', { yearsSinceBirth: 'age' })
    .select()
    .from('users_composite');

  const r2 = await knexInstance
    .column('id', { yearsSinceBirth: 'age' as 'age' })
    .select()
    .from<User>('users');

  type TR2_1 = ExtendsWitness<
    { id: number; yearsSinceBirth: number },
    typeof r2[0]
  >;
  type TR2_2 = ExtendsWitness<number, typeof r1[0]['id']>;
  type TR2_3 = ExtendsWitness<number, typeof r1[0]['yearsSinceBirth']>;

  // $ExpectType (Pick<User, "id"> & { yearsSinceBirth: number; })[]
  await knexInstance
    .column('id', { yearsSinceBirth: 'age' as 'age' })
    .select()
    .from('users_inferred');

  // $ExpectType (Pick<User, "id"> & { yearsSinceBirth: number; })[]
  await knexInstance
    .column('id', { yearsSinceBirth: 'age' as 'age' })
    .select()
    .from('users_composite');

  // ## Conditional Selection:

  // $ExpectType User[]
  await knexInstance<User>('users').where({ id: 10 });

  // $ExpectType User[]
  await knexInstance('users_inferred').where({ id: 10 });

  // $ExpectType User[]
  await knexInstance('users_composite').where({ id: 10 });

  // $ExpectType Pick<User, "name" | "id">[]
  await knexInstance<User>('users')
    .select('id', 'name')
    .where({ id: 10 });

  // $ExpectType Pick<User, "name" | "id">[]
  await knexInstance('users_inferred')
    .select('id', 'name')
    .where({ id: 10 });

  // $ExpectType Pick<User, "name" | "id">[]
  await knexInstance('users_composite')
    .select('id', 'name')
    .where({ id: 10 });

  // $ExpectType Partial<User>[]
  await knexInstance
    .select<Partial<User>[]>(['users.*', 'departments.name as depName'])
    .from('users')
    .join('departments', 'departments.id', '=', 'users.department_id')
    .orderBy('name');

  // $ExpectType Partial<User> | undefined
  await knexInstance
    .select<Partial<User>[]>(['users.*', 'departments.name as depName'])
    .from('users')
    .join('departments', 'departments.id', '=', 'users.department_id')
    .orderBy('name')
    .first();

  // $ExpectType Partial<User>[]
  await knexInstance
    .select<Partial<User>[]>(['users.*', 'departments.name as depName'])
    .from('users')
    .join('departments', 'departments.id', '=', 'users.department_id')
    .orderByRaw('name DESC');

  // $ExpectType User | undefined
  await knexInstance<User>('users')
    .where({ id: 10 })
    .first();

  // $ExpectType User | undefined
  await knexInstance('users_inferred')
    .where({ id: 10 })
    .first();

  // $ExpectType User | undefined
  await knexInstance('users_composite')
    .where({ id: 10 })
    .first();

  // $ExpectType any[]
  await knexInstance.where({ id: 10 }).from('users');

  // $ExpectType any
  await knexInstance.where({ id: 10 }).from('users').first();

  // $ExpectType User[]
  await knexInstance.where({ id: 10 }).from<User>('users');

  // $ExpectType User[]
  await knexInstance.where({ id: 10 }).from('users_inferred');

  // $ExpectType User[]
  await knexInstance.where({ id: 10 }).from('users_composite');

  // $ExpectType User | undefined
  await knexInstance
    .where({ id: 10 })
    .from<User>('users')
    .clearWhere()
    .where({ id: 11 })
    .orWhere({ id: 12 })
    .first();

  // $ExpectType User | undefined
  await knexInstance
    .where({ id: 10 })
    .from('users_inferred')
    .clearWhere()
    .where({ id: 11 })
    .orWhere({ id: 12 })
    .first();

  // $ExpectType User | undefined
  await knexInstance
    .where({ id: 10 })
    .from('users_composite')
    .clearWhere()
    .where({ id: 11 })
    .orWhere({ id: 12 })
    .first();

  // $ExpectType User[]
  await knexInstance
    .where({ id: 10 })
    .where('age', '>', 20)
    .from<User>('users');

  // $ExpectType User[]
  await knexInstance
    .where({ id: 10 })
    .where('age', '>', 20)
    .from('users_inferred');

  // $ExpectType User[]
  await knexInstance
    .where({ id: 10 })
    .where('age', '>', 20)
    .from('users_composite');

  // $ExpectType User[]
  await knexInstance<User>('users').whereNot('age', '>', 100);

  // $ExpectType User[]
  await knexInstance('users_inferred').whereNot('age', '>', 100);

  // $ExpectType User[]
  await knexInstance('users_composite').whereNot('age', '>', 100);

  // ### Boolean operations

  // $ExpectType User[]
  await knexInstance<User>('users').not.where('id', 10);

  // $ExpectType User[]
  await knexInstance('users_inferred').not.where('id', 10);

  // $ExpectType User[]
  await knexInstance('users_composite').not.where('id', 10);

  // $ExpectType User[]
  await knexInstance<User>('user').where('name', 'L').and.where('age', 20);

  // $ExpectType User[]
  await knexInstance('users_inferred').where('name', 'L').and.where('age', 20);

  // $ExpectType User[]
  await knexInstance('users_composite').where('name', 'L').and.where('age', 20);

  // $ExpectType User[]
  await knexInstance<User>('user').where('name', 'L').or.where('age', 20);

  // $ExpectType User[]
  await knexInstance('users_inferred').where('name', 'L').or.where('age', 20);

  // $ExpectType User[]
  await knexInstance('users_composite').where('name', 'L').or.where('age', 20);

  // ## Aggregation:

  const u4: User[] = await knexInstance('users')
    .groupBy('count')
    .orderBy('name', 'desc')
    .having('age', '>', 10);

  const u5: User[] = await knexInstance('users')
    .groupBy('count')
    .orderBy('name', 'desc')
    .having(knexInstance.raw('age > ?', 10));

  const u6: User[] = await knexInstance('users')
    .groupBy('count')
    .orderBy('name', 'desc')
    .having(knexInstance.raw('age'), '>', 10);

  // $ExpectType User[]
  await knexInstance<User>('users')
    .groupBy('count')
    .orderBy('name', 'desc')
    .having('age', '>', 10);

  // $ExpectType User[]
  await knexInstance('users_inferred')
    .groupBy('count')
    .orderBy('name', 'desc')
    .having('age', '>', 10);

  // $ExpectType User[]
  await knexInstance('users_composite')
    .groupBy('count')
    .orderBy('name', 'desc')
    .having('age', '>', 10);

  // $ExpectType User[]
  await knexInstance<User>('users')
    .groupByRaw('count')
    .orderBy('name', 'desc')
    .having('age', '>', 10);

  // $ExpectType User[]
  await knexInstance('users_inferred')
    .groupByRaw('count')
    .orderBy('name', 'desc')
    .having('age', '>', 10);

  // $ExpectType User[]
  await knexInstance('users_composite')
    .groupByRaw('count')
    .orderBy('name', 'desc')
    .having('age', '>', 10);

  // $ExpectType User[]
  await knexInstance<User>('users')
    .groupByRaw('count')
    .orderBy('name', 'desc')
    .havingRaw('age > ?', [10]);

  // $ExpectType User[]
  await knexInstance('users_inferred')
    .groupByRaw('count')
    .orderBy('name', 'desc')
    .havingRaw('age > ?', [10]);

  // $ExpectType User[]
  await knexInstance('users_composite')
    .groupByRaw('count')
    .orderBy('name', 'desc')
    .havingRaw('age > ?', [10]);

  // $ExpectType User[]
  await knexInstance<User>('users')
    .select()
    .orderBy(
      knexInstance<User>('users')
        .select('u.id')
        .from('users as u')
        .where('users.id', 'u.id')
    );

  // $ExpectType User[]
  await knexInstance('users_inferred')
    .select()
    .orderBy(
      knexInstance('users_inferred')
        .select('u.id')
        .from('users as u')
        .where('users.id', 'u.id')
    );

  // $ExpectType User[]
  await knexInstance('users_composite')
    .select()
    .orderBy(
      knexInstance('users_composite')
        .select('u.id')
        .from('users as u')
        .where('users.id', 'u.id')
    );

  // $ExpectType User[]
  await knexInstance<User>('users')
    .select()
    .orderBy([{
      column: knexInstance<User>('users')
        .select('u.id')
        .from('users as u')
        .where('users.id', 'u.id'),
      order: 'desc'
    }]);

  // $ExpectType User[]
  await knexInstance('users_inferred')
    .select()
    .orderBy([{
      column: knexInstance('users_inferred')
        .select('u.id')
        .from('users as u')
        .where('users.id', 'u.id'),
      order: 'desc'
    }]);

  // $ExpectType User[]
  await knexInstance('users_composite')
    .select()
    .orderBy([{
      column: knexInstance('users_composite')
        .select('u.id')
        .from('users as u')
        .where('users.id', 'u.id'),
      order: 'desc'
    }]);

  // $ExpectType User[]
  await knexInstance<User>('users')
    .select()
    .orderBy([{
      column: 'id',
      order: 'desc'
    }, {
      column: 'name',
      order: 'desc'
    }]);

  // $ExpectType User[]
  await knexInstance('users_inferred')
    .select()
    .orderBy([{
      column: 'id',
      order: 'desc'
    }, {
      column: 'name',
      order: 'desc'
    }]);

  // $ExpectType User[]
  await knexInstance('users_composite')
    .select()
    .orderBy([{
      column: 'id',
      order: 'desc'
    }, {
      column: 'name',
      order: 'desc'
    }]);

  // $ExpectType User[]
  await knexInstance<User>('users')
    .select()
    .orderBy([{
      column: 'id',
      order: 'desc'
    }, 'name']);

  // $ExpectType User[]
  await knexInstance('users_inferred')
    .select()
    .orderBy([{
      column: 'id',
      order: 'desc'
    }, 'name']);

  // $ExpectType User[]
  await knexInstance('users_composite')
    .select()
    .orderBy([{
      column: 'id',
      order: 'desc'
    }, 'name']);

  // $ExpectType Dict<string | number>[]
  await knexInstance<User>('users').count();

  // $ExpectType Dict<string | number>[]
  await knexInstance('users_inferred').count();

  // $ExpectType Dict<string | number>[]
  await knexInstance('users_composite').count();

  // $ExpectType Dict<string | number>[]
  await knexInstance<User>('users').count('age');

  // $ExpectType Dict<string | number>[]
  await knexInstance('users_inferred').count('age');

  // $ExpectType Dict<string | number>[]
  await knexInstance('users_composite').count('age');

  // $ExpectType Dict<string | number>[]
  await knexInstance('users').count('age');

  // $ExpectType { c: string | number; }[]
  await knexInstance<User>('users').count('id', { as: 'c' });

  // $ExpectType (Pick<User, "departmentId"> & { c: string | number; })[]
  await knexInstance<User>('users').select('departmentId').count('id', { as: 'c' });

  // $ExpectType { count: number; }
  await knexInstance('foo').first().count<{count: number}>({count: '*'});

  // $ExpectType { count: number; }
  await knexInstance('foo').first().countDistinct<{count: number}>({count: '*'});

  // $ExpectType { count?: string | number | undefined; }
  await knexInstance('foo').first().count({count: '*'});

  // $ExpectType { count?: string | number | undefined; }
  await knexInstance('foo').first().countDistinct({count: '*'});

  // $ExpectType Dict<string | number>
  await knexInstance<User>('users').first().count('age');

  // $ExpectType Dict<string | number>
  await knexInstance('users_inferred').first().count('age');

  // $ExpectType Dict<string | number>
  await knexInstance('users_composite').first().count('age');

  // $ExpectType Dict<string | number>
  await knexInstance('users').first().count('age', 'id');

  // $ExpectType Dict<string | number>
  await knexInstance<User>('users').first().count();

  // $ExpectType Dict<string | number>
  await knexInstance('users_inferred').first().count();

  // $ExpectType Dict<string | number>
  await knexInstance('users_composite').first().count();

  // $ExpectType Dict<string | number>[]
  await knexInstance.count().from<User>('users');

  // $ExpectType Dict<string | number>[]
  await knexInstance.count().from('users_inferred');

  // $ExpectType Dict<string | number>[]
  await knexInstance.count().from('users_composite');

  // $ExpectType Dict<string | number>[]
  await knexInstance.count('age').from<User>('users');

  // $ExpectType Dict<string | number>[]
  await knexInstance.count('age').from('users_inferred');

  // $ExpectType Dict<string | number>[]
  await knexInstance.count('age').from('users_composite');

  // $ExpectType Dict<string | number>[]
  await knexInstance.count('age').from('users');

  // $ExpectType { count: number; }
  await knexInstance.first().count<{count: number}>({count: '*'}).from('foo');

  // $ExpectType { count: number; }
  await knexInstance.first().countDistinct<{count: number}>({count: '*'}).from('foo');

  // $ExpectType { count?: string | number | undefined; }
  await knexInstance.first().count({count: '*'}).from('foo');

  // $ExpectType { count?: string | number | undefined; }
  await knexInstance.first().countDistinct({count: '*'}).from('foo');

  // $ExpectType Dict<string | number>
  await knexInstance.first().count('age').from<User>('users');

  // $ExpectType Dict<string | number>
  await knexInstance.first().count('age').from('users_inferred');

  // $ExpectType Dict<string | number>
  await knexInstance.first().count('age').from('users_composite');

  // $ExpectType Dict<string | number>
  await knexInstance.first().count('age', 'id').from('users');

  // $ExpectType Dict<string | number>
  await knexInstance.first().count().from<User>('users');

  // $ExpectType Dict<string | number>
  await knexInstance.first().count().from('users_inferred');

  // $ExpectType Dict<string | number>
  await knexInstance.first().count().from('users_composite');

  // $ExpectType Dict<number>[]
  await knexInstance<User>('users').max('age');

  // $ExpectType Dict<number>[]
  await knexInstance('users_inferred').max('age');

  // $ExpectType Dict<number>[]
  await knexInstance('users_composite').max('age');

  // $ExpectType Dict<number>
  await knexInstance<User>('users').first().max('age');

  // $ExpectType Dict<number>
  await knexInstance('users_inferred').first().max('age');

  // $ExpectType Dict<number>
  await knexInstance('users_composite').first().max('age');

  // $ExpectType Dict<any>[]
  await knexInstance('users').max('age');

  // $ExpectType Dict<number>[]
  await knexInstance<User>('users').min('age');

  // $ExpectType Dict<number>[]
  await knexInstance('users_inferred').min('age');

  // $ExpectType Dict<number>[]
  await knexInstance('users_composite').min('age');

  // $ExpectType Dict<number>
  await knexInstance<User>('users').first().min('age');

  // $ExpectType Dict<number>
  await knexInstance('users_inferred').first().min('age');

  // $ExpectType Dict<number>
  await knexInstance('users_composite').first().min('age');

  // $ExpectType Dict<any>[]
  await knexInstance.max('age').from<User>('users');

  // $ExpectType Dict<any>[]
  await knexInstance.max('age').from('users_inferred');

  // $ExpectType Dict<any>[]
  await knexInstance.max('age').from('users_composite');

  // $ExpectType Dict<any>
  await knexInstance.first().max('age').from<User>('users');

  // $ExpectType Dict<any>
  await knexInstance.first().max('age').from('users_inferred');

  // $ExpectType Dict<any>
  await knexInstance.first().max('age').from('users_composite');

  // $ExpectType Dict<any>[]
  await knexInstance.max('age').from('users');

  // $ExpectType Dict<any>[]
  await knexInstance.min('age').from<User>('users');

  // $ExpectType Dict<any>[]
  await knexInstance.min('age').from('users_inferred');

  // $ExpectType Dict<any>[]
  await knexInstance.min('age').from('users_composite');

  // $ExpectType Dict<any>
  await knexInstance.first().min('age').from<User>('users');

  // $ExpectType ({ a: string | Date; } & { b: string | Date; })[]
  await knexInstance<Ticket>('tickets')
    .min('at', {as: 'a'})
    .max('at', {as: 'b'});

  // $ExpectType ({ dep: any; } & { a: any; } & { b: any; })[]
  await knexInstance
    .select({dep: 'departmentId'})
    .min('age', {as: 'a'})
    .max('age', {as: 'b'})
    .from<User>('users');

  // $ExpectType ({ dep: any; } & { a?: any; } & { b?: any; })[]
  await knexInstance
    .select({dep: 'departmentId'})
    .min({a: 'age'})
    .max({b: 'age'})
    .from<User>('users');

  // $ExpectType ({ dep: any; } & { a?: any; } & { b?: any; })[]
  await knexInstance
    .select({dep: 'departmentId'})
    .min({a: 'age'})
    .max({b: 'age'})
    .from('users_inferred');

  // $ExpectType ({ dep: any; } & { a?: any; } & { b?: any; })[]
  await knexInstance
    .select({dep: 'departmentId'})
    .min({a: 'age'})
    .max({b: 'age'})
    .from('users_composite');

  // $ExpectType ({ dep: number; } & { a?: any; } & { b?: any; })[]
  await knexInstance<User>('users')
    .select({dep: 'departmentId'})
    .min({a: 'age'})
    .max({b: 'age'});

  // $ExpectType ({ dep: number; } & { a?: any; } & { b?: any; })[]
  await knexInstance('users_inferred')
    .select({dep: 'departmentId'})
    .min({a: 'age'})
    .max({b: 'age'});

  // $ExpectType ({ dep: number; } & { a?: any; } & { b?: any; })[]
  await knexInstance('users_composite')
    .select({dep: 'departmentId'})
    .min({a: 'age'})
    .max({b: 'age'});

  // $ExpectType ({ dep: number; } & { a?: string | number | undefined; })[]
  await knexInstance<User>('users')
    .select({dep: 'departmentId'})
    .count({a: 'age'});

  // $ExpectType ({ dep: number; } & { a?: string | number | undefined; })[]
  await knexInstance('users_inferred')
    .select({dep: 'departmentId'})
    .count({a: 'age'});

  // $ExpectType ({ dep: number; } & { a?: string | number | undefined; })[]
  await knexInstance('users_composite')
    .select({dep: 'departmentId'})
    .count({a: 'age'});

  // Type of dep can't be inferred if User type is not available
  // at the time of select

  // $ExpectType ({ dep: any; } & { a?: string | number | undefined; })[]
  await knexInstance
    .select({dep: 'departmentId'})
    .count({a: 'age'})
    .from<User>('users');

  // $ExpectType ({ dep: any; } & { a?: string | number | undefined; })[]
  await knexInstance
    .select({dep: 'departmentId'})
    .count({a: 'age'})
    .from('users_inferred');

  // $ExpectType ({ dep: any; } & { a?: string | number | undefined; })[]
  await knexInstance
    .select({dep: 'departmentId'})
    .count({a: 'age'})
    .from('users_composite');

  // Analytic
  // $ExpectType (Pick<User, "age"> & { rowNum: number; })[]
  await knexInstance<User>('users').select('age').rowNumber('rowNum', 'age');

  await knexInstance<User>('users')
    .select('age')
    // $ExpectError
    .rowNumber('rowNum', 'non_existing_field');

  // $ExpectType (Pick<User, "age"> & { rowNum: number; })[]
  await knexInstance<User>('users').select('age').rowNumber('rowNum', ['age']);

  // $ExpectType (Pick<User, "age"> & { rowNum: number; })[]
  await knexInstance<User>('users').select('age').rowNumber('rowNum', (builder) => {
    builder.orderBy('age');
  });

  // $ExpectType (Pick<User, "age"> & { rowNum: number; })[]
  await knexInstance<User>('users').select('age').rowNumber('rowNum', 'age', 'departmentId');

  await knexInstance<User>('users')
    .select('age')
    // $ExpectError
    .rowNumber('rowNum', 'age', 'non_existing_field');

  // $ExpectType (Pick<User, "age"> & { rowNum: number; })[]
  await knexInstance<User>('users').select('age').rowNumber('rowNum', 'age', ['departmentId', 'active']);

  // $ExpectType (Pick<User, "age"> & { rowNum: number; })[]
  await knexInstance<User>('users').select('age').rowNumber('rowNum', (builder) => {
    builder.orderBy('age').partitionBy('departmentId');
  });

  // ## With inner query:

  // ### For column selection:

  // $ExpectType any[]
  await knexInstance('users').select(
    knexInstance('foo')
      .select('bar')
      .as('colName')
  );

  // $ExpectType any[]
  await knexInstance<User>('users').select(
    knexInstance('foo')
      .select('bar')
      .as('colName')
  );

  // $ExpectType Pick<User, "name" | "age">[]
  await knexInstance<User>('users').select<Pick<User, 'name' | 'age'>[]>(
    knexInstance('foo')
      .select('bar')
      .as('colName')
  );

  // ### For condition:

  // $ExpectType any[]
  await knexInstance('users').whereNot(function() {
    this.where('id', 1).orWhereNot('id', '>', 10);
  });

  // $ExpectType User[]
  await knexInstance<User>('users').whereNot(function() {
    this.where('id', 1).orWhereNot('id', '>', 10);
  });

  // $ExpectType User[]
  await knexInstance('users_inferred').whereNot(function() {
    this.where('id', 1).orWhereNot('id', '>', 10);
  });

  // $ExpectType User[]
  await knexInstance('users_composite').whereNot(function() {
    this.where('id', 1).orWhereNot('id', '>', 10);
  });

  // $ExpectType User[]
  await knexInstance<User>('users')
    .where((builder) =>
      builder.whereIn('id', [1, 11, 15]).whereNotIn('id', [17, 19])
    )
    .andWhere(function() {
      this.where('id', '>', 10);
    });

  // $ExpectType User[]
  await knexInstance('users_inferred')
    .where((builder) =>
      builder.whereIn('id', [1, 11, 15]).whereNotIn('id', [17, 19])
    )
    .andWhere(function() {
      this.where('id', '>', 10);
    });

  // $ExpectType User[]
  await knexInstance('users_composite')
    .where((builder) =>
      builder.whereIn('id', [1, 11, 15]).whereNotIn('id', [17, 19])
    )
    .andWhere(function() {
      this.where('id', '>', 10);
    });

  // $ExpectType User | undefined
  await knexInstance<User>('users')
    .where((builder) =>
      builder.whereIn('id', [1, 11, 15]).whereNotIn('id', [17, 19])
    )
    .andWhere(function() {
      this.where('id', '>', 10);
    })
    .first();

  // $ExpectType User | undefined
  await knexInstance('users_inferred')
    .where((builder) =>
      builder.whereIn('id', [1, 11, 15]).whereNotIn('id', [17, 19])
    )
    .andWhere(function() {
      this.where('id', '>', 10);
    })
    .first();

  // $ExpectType User | undefined
  await knexInstance('users_composite')
    .where((builder) =>
      builder.whereIn('id', [1, 11, 15]).whereNotIn('id', [17, 19])
    )
    .andWhere(function() {
      this.where('id', '>', 10);
    })
    .first();

  const values = [[1, 'a'], [2, 'b']] as const;
  const cols = ['id', 'name'] as const;

  // $ExpectType User[]
  await knexInstance<User>('users')
    .whereIn<"id" | "name">(cols, values);

  // $ExpectType User[]
  await knexInstance('users_inferred')
    .whereIn<"id" | "name">(cols, values);

  // $ExpectType User[]
  await knexInstance('users_composite')
    .whereIn<"id" | "name">(cols, values);

  // $ExpectType User[]
  await knexInstance<User>('user').whereIn('id', [1, 2]);

  const col = 'id';
  const idList = [1, 2] as const;
  // $ExpectType User[]
  await knexInstance<User>('user').whereIn(col, idList);

  // $ExpectType User[]
  await knexInstance('users_inferred').whereIn(col, idList);

  // $ExpectType User[]
  await knexInstance('users_composite').whereIn(col, idList);

  // $ExpectType User[]
  await knexInstance<User>('users').whereNotExists(function() {
    this.select('*')
      .from('accounts')
      .whereRaw('users.account_id = accounts.id');
  });

  // $ExpectType User[]
  await knexInstance('users_inferred').whereNotExists(function() {
    this.select('*')
      .from('accounts')
      .whereRaw('users.account_id = accounts.id');
  });

  // $ExpectType User[]
  await knexInstance('users_composite').whereNotExists(function() {
    this.select('*')
      .from('accounts')
      .whereRaw('users.account_id = accounts.id');
  });

  // ## Union Queries:

  // $ExpectType any[]
  await knexInstance
    .select('*')
    .from('users')
    .whereNull('last_name')
    .union(function() {
      this.select('*')
        .from('users')
        .whereNull('first_name');
    });

  // $ExpectType User[]
  await knexInstance<User>('users')
    .select('*')
    .whereNull('name')
    .union(function() {
      this.select('*')
        .from<User>('users')
        .whereNull('first_name');
    });

  // $ExpectType User[]
  await knexInstance('users_inferred')
    .select('*')
    .whereNull('name')
    .union(function() {
      this.select('*')
        .from('users_inferred')
        .whereNull('first_name');
    });

  // $ExpectType User[]
  await knexInstance('users_composite')
    .select('*')
    .whereNull('name')
    .union(function() {
      this.select('*')
        .from('users_composite')
        .whereNull('first_name');
    });

  // ## Joins:

  // $ExpectType any[]
  await knexInstance('users').innerJoin(
    'departments',
    'users.departmentId',
    'departments.id'
  );

  // $ExpectType any[]
  await knexInstance<User>('users').innerJoin(
    'departments',
    'users.departmentId',
    'departments.id'
  );

  // $ExpectType any[]
  await knexInstance('users').innerJoin<Department>(
    'departments',
    'users.departmentId',
    'departments.id'
  );

  // $ExpectType (User & Department)[]
  await knexInstance<User>('users').innerJoin<Department>(
    'departments',
    'users.departmentId',
    'departments.id'
  );

  // $ExpectType (User & Department)[]
  await knexInstance('users_inferred').innerJoin(
    'departments_inferred',
    'users_inferred.departmentId',
    'departments_inferred.id'
  );

  // $ExpectType (User & Department)[]
  await knexInstance('users_composite').innerJoin(
    'departments_composite',
    'users_composite.departmentId',
    'departments_composite.id'
  );

  // $ExpectType (User & Department & Article)[]
  await knexInstance<User>('users')
    .innerJoin<Department>(
      'departments',
      'users.departmentId',
      'departments.id'
    )
    .innerJoin<Article>('articles', 'articles.authorId', 'users.id');

  // $ExpectType (User & Department & Article)[]
  await knexInstance('users_inferred')
    .innerJoin(
      'departments_inferred',
      'users_inferred.departmentId',
      'departments_inferred.id'
    )
    .innerJoin('articles_inferred', 'articles_inferred.authorId', 'users_inferred.id');

  // $ExpectType (User & Department & Article)[]
  await knexInstance('users_composite')
    .innerJoin(
      'departments_composite',
      'users_composite.departmentId',
      'departments_composite.id'
    )
    .innerJoin('articles_composite', 'articles_composite.authorId', 'users_composite.id');

  // $ExpectType any[]
  await knexInstance<User>('users')
    .innerJoin('departments', 'users.departmentId', 'departments.id')
    .innerJoin<Article>('articles', 'articles.authorId', 'users.id');

  // $ExpectType any[]
  await knexInstance('users_inferred')
    .innerJoin('departments', 'users_inferred.departmentId', 'departments.id')
    .innerJoin('articles_inferred', 'articles_inferred.authorId', 'users.id');

  // $ExpectType (User & Department)[]
  await knexInstance<User>('users').innerJoin<Department>(
    'departments',
    'users.departmentId',
    '=',
    'departments.id'
  );

  // $ExpectType (User & Department)[]
  await knexInstance('users_inferred').innerJoin(
    'departments_inferred',
    'users_inferred.departmentId',
    '=',
    'departments_inferred.id'
  );

  // $ExpectType (User & Department)[]
  await knexInstance('users_composite').innerJoin(
    'departments_composite',
    'users_composite.departmentId',
    '=',
    'departments_composite.id'
  );

  // $ExpectType { username: any; }[]
  (await knexInstance<User>('users')
    .innerJoin('departments', 'users.departmentId', 'departments.id'))
    .map(function(joined) {
      return {
        username: joined.name,
      };
    });

  // $ExpectType { username: string; }[]
  (await knexInstance<User>('users')
    .innerJoin<Department>(
      'departments',
      'users.departmentId',
      'departments.id'
    ))
    .map(function(joined) {
      return {
        username: joined.name,
      };
    });

  // $ExpectType { username: string; }[]
  (await knexInstance('users_inferred')
    .innerJoin(
      'departments_inferred',
      'users_inferred.departmentId',
      'departments_inferred.id'
    ))
    .map(function(joined) {
      return {
        username: joined.name,
      };
    });

  // $ExpectType { username: string; }[]
  (await knexInstance('users_composite')
    .innerJoin(
      'departments_composite',
      'users_composite.departmentId',
      'departments_composite.id'
    ))
    .map(function(joined) {
      return {
        username: joined.name,
      };
    });

  // $ExpectType { username: string; }[]
  (await knexInstance<User>('users')
    .innerJoin<Department>(
      'departments',
      'users.departmentId',
      'departments.id'
    )
    .select('*'))
    .map(function(joined) {
      return {
        username: joined.name,
      };
    });

  // $ExpectType { username: string; }[]
  (await knexInstance('users_inferred')
    .innerJoin(
      'departments_inferred',
      'users_inferred.departmentId',
      'departments_inferred.id'
    )
    .select('*'))
    .map(function(joined) {
      return {
        username: joined.name,
      };
    });

  // $ExpectType { username: string; }[]
  (await knexInstance('users_composite')
    .innerJoin<Department>(
      'departments_composite',
      'users_composite.departmentId',
      'departments_composite.id'
    )
    .select('*'))
    .map(function(joined) {
      return {
        username: joined.name,
      };
    });

  // $ExpectType { username: string; }[]
  (await knexInstance<User>('users')
    .innerJoin<Department>(
      'departments',
      'users.departmentId',
      'departments.id'
    )
    .select())
    .map(function(joined) {
      return {
        username: joined.name,
      };
    });

  // $ExpectType { username: string; }[]
  (await knexInstance('users_inferred')
    .innerJoin(
      'departments_inferred',
      'users_inferred.departmentId',
      'departments_inferred.id'
    )
    .select())
    .map(function(joined) {
      return {
        username: joined.name,
      };
    });

  // $ExpectType { username: string; }[]
  (await knexInstance('users_composite')
    .innerJoin(
      'departments_composite',
      'users_composite.departmentId',
      'departments_composite.id'
    )
    .select())
    .map(function(joined) {
      return {
        username: joined.name,
      };
    });

  // $ExpectType { username: string; }[]
  (await knexInstance<User>('users')
    .innerJoin<Department>(
      'departments',
      'users.departmentId',
      'departments.id'
    )
    .select('name', 'age'))
    .map(function(joined) {
      return {
        username: joined.name,
      };
    });

  // $ExpectType { username: string; }[]
  (await knexInstance('users_inferred')
    .innerJoin(
      'departments_inferred',
      'users_inferred.departmentId',
      'departments_inferred.id'
    )
    .select('name', 'age'))
    .map(function(joined) {
      return {
        username: joined.name,
      };
    });

  // $ExpectType { username: string; }[]
  (await knexInstance('users_composite')
    .innerJoin(
      'departments_composite',
      'users_composite.departmentId',
      'departments_composite.id'
    )
    .select('name', 'age'))
    .map(function(joined) {
      return {
        username: joined.name,
      };
    });

  // $ExpectType { username: any; }[]
  (await knexInstance<User>('users')
    .innerJoin<Department>(
      'departments',
      'users.departmentId',
      'departments.id'
    )
    .select('users.name', 'age'))
    .map(function(joined) {
      return {
        username: joined.name,
      };
    });

  // $ExpectType { username: any; }[]
  (await knexInstance('users_inferred')
    .innerJoin(
      'departments_inferred',
      'users_inferred.departmentId',
      'departments_inferred.id'
    )
    .select('users_inferred.name', 'age'))
    .map(function(joined) {
      return {
        username: joined.name,
      };
    });

  // $ExpectType { username: any; }[]
  (await knexInstance('users_composite')
    .innerJoin(
      'departments_composite',
      'users_composite.departmentId',
      'departments_composite.id'
    )
    .select('users_composite.name', 'age'))
    .map(function(joined) {
      return {
        username: joined.name,
      };
    });

  // $ExpectType (User & Department)[]
  await knexInstance
    .select<(User & Department)[]>('users')
    .innerJoin('departments', 'users.departmentId', 'departments.id');

  // $ExpectType (User & Department)[]
  await knexInstance<User>('users').innerJoin<Department>('departments', function() {
    this.on('users.id', '=', 'departments.id');
  });

  // $ExpectType (User & Department)[]
  await knexInstance('users_inferred').innerJoin('departments_inferred', function() {
    this.on('users_inferred.id', '=', 'departments_inferred.id');
  });

  // $ExpectType (User & Department)[]
  await knexInstance('users_composite').innerJoin('departments_composite', function() {
    this.on('users_composite.id', '=', 'departments_composite.id');
  });

  // $ExpectType any[]
  await knexInstance<User>('users')
    .innerJoin<Department>(
      'departments',
      'users.departmentId',
      'departments.id'
    )
    .select('users.id', 'departments.id');

  // $ExpectType (User & Department)[]
  await knexInstance
    .select('*')
    .from<User>('users')
    .join<Department>('departments', function() {
      this.on(function() {
        this.on('departments.id', '=', 'users.department_id');
        this.orOn('departments.owner_id', '=', 'users.id');
      });
    });

  // $ExpectType (User & Department)[]
  await knexInstance
    .select('*')
    .from('users_inferred')
    .join('departments_inferred', function() {
      this.on(function() {
        this.on('departments_inferred.id', '=', 'users_inferred.department_id');
        this.orOn('departments_inferred.owner_id', '=', 'users_inferred.id');
      });
    });

  // $ExpectType (User & Department)[]
  await knexInstance
    .select('*')
    .from('users_composite')
    .join('departments_composite', function() {
      this.on(function() {
        this.on('departments_composite.id', '=', 'users_composite.department_id');
        this.orOn('departments_composite.owner_id', '=', 'users_composite.id');
      });
    });

  // # Insertion

  // $ExpectType number[]
  await knexInstance('users').insert({ id: 10 });

  // $ExpectType number[]
  await knexInstance<User>('users').insert({ id: 10 });

  // $ExpectType number[]
  await knexInstance('users_inferred').insert({ id: 10 });

  // $ExpectError
  await knexInstance('users_composite').insert({ id: 10 });

  // $ExpectError
  await knexInstance('users_composite').insert({});

  // $ExpectType number[]
  await knexInstance('users_composite').insert({ insert: 'insert' });

  // $ExpectType number[]
  await knexInstance('users').insert([{ id: 10 }]);

  // $ExpectType number[]
  await knexInstance<User>('users').insert([{ id: 10 }]);

  // $ExpectType number[]
  await knexInstance('users_inferred').insert([{ id: 10 }]);

  // $ExpectError
  await knexInstance('users_composite').insert([{ id: 10 }]);

  // $ExpectError
  await knexInstance('users_composite').insert([{}]);

  // $ExpectType number[]
  await knexInstance('users_composite').insert([{ insert: 'insert' }]);

  const qb2 = knexInstance<User>('users');
  qb2.returning(['id', 'name']);

  const qb2ReturnCols = ['id', 'name'] as const;
  qb2.returning(qb2ReturnCols);

  // $ExpectType Partial<User>[]
  await qb2.insert<Partial<User>[]>({ id: 10 });

  // ## With returning

  // $ExpectType any[]
  await knexInstance('users')
    .insert({ id: 10 })
    .returning('id');

  // $ExpectType number[]
  await knexInstance('users')
    .insert({ id: 10 })
    .returning<number[]>('id');

  // $ExpectType string[]
  await knexInstance<User>('users')
    .insert({ id: 10 })
    .returning<string[]>('id');

  // $ExpectType number[]
  await knexInstance<User>('users')
    .insert({ id: 10 })
    .returning('id');

  // $ExpectType number[]
  await knexInstance('users_inferred')
    .insert({ id: 10 })
    .returning('id');

  // $ExpectType number[]
  await knexInstance('users_composite')
    .insert({ insert: 'insert' })
    .returning('id');

  await knexInstance('users_composite')
    // $ExpectError
    .insert({ id: 10 })
    .returning('id');

  // Require insert argument to satisfy "insert" interface fully when composite type is available.
  await knexInstance('users_composite')
    // $ExpectError
    .insert({})
    .returning('id');

  // $ExpectType any[]
  await knexInstance('users')
    .insert([{ id: 10 }])
    .returning('id');

  // $ExpectType number[]
  await knexInstance('users')
    .insert([{ id: 10 }])
    .returning<number[]>('id');

  // $ExpectType string[]
  await knexInstance<User>('users')
    .insert([{ id: 10 }])
    .returning<string[]>('id');

  // $ExpectType number[]
  await knexInstance<User>('users')
    .insert([{ id: 10 }])
    .returning('id');

  // $ExpectType number[]
  await knexInstance('users_inferred')
    .insert([{ id: 10 }])
    .returning('id');

  // $ExpectType number[]
  await knexInstance('users_composite')
    .insert([{ insert: 'insert' }])
    .returning('id');

  await knexInstance('users_composite')
    // $ExpectError
    .insert([{ id: 10 }])
    .returning('id');

  // Require insert argument to satisfy "insert" interface fully when composite type is available.
  await knexInstance('users_composite')
    // $ExpectError
    .insert({})
    .returning('id');

  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance<User>('users')
    .insert({ id: 10 })
    .returning(['id', 'age']);

  // $ExpectType number[]
  await knexInstance<User>('users').insert({ id: 10 }, 'id');

  // $ExpectType User[]
  await knexInstance<User>('users').insert({ id: 10 }, '*');

  // $ExpectType User[]
  await knexInstance('users_inferred').insert({ id: 10 }, '*');

  // $ExpectError
  await knexInstance('users_composite').insert({ id: 10 }, '*');

  // $ExpectError
  await knexInstance('users_composite').insert({}, '*');

  // $ExpectType User[]
  await knexInstance('users_composite').insert({ insert: 'insert' }, '*');

  // $ExpectType User[]
  await knexInstance<User>('users').insert([{ id: 10 }], '*');

  // $ExpectType User[]
  await knexInstance('users_inferred').insert([{ id: 10 }], '*');

  // $ExpectError
  await knexInstance('users_composite').insert([{ id: 10 }], '*');

  // $ExpectError
  await knexInstance('users_composite').insert([{}], '*');

  // $ExpectType User[]
  await knexInstance('users_composite').insert([{ insert: 'insert' }], '*');

  // $ExpectType number[]
  await knexInstance.insert({ id: 10 }, 'id').into<User>('users');

  // $ExpectType number[]
  await knexInstance.insert({ id: 10 }, 'id').into('users_inferred');

  // $ExpectType number[]
  await knexInstance.insert({ insert: 'insert' }, 'id').into('users_composite');

  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance<User>('users')
    .insert({ id: 10 })
    .returning(['id', 'age']);

  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance('users_inferred')
    .insert({ id: 10 })
    .returning(['id', 'age']);

  await knexInstance('users_composite')
    // $ExpectError
    .insert({ id: 10 })
    .returning(['id', 'age']);

  await knexInstance('users_composite')
    // $ExpectError
    .insert({})
    .returning(['id', 'age']);

  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance('users_composite')
    .insert({ insert: 'insert' })
    .returning(['id', 'age']);

  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance<User>('users')
    .insert({ id: 10 }, 'id')
    .returning(['id', 'age']);

  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance('users_inferred')
    .insert({ id: 10 }, 'id')
    .returning(['id', 'age']);

  await knexInstance('users_composite')
    // $ExpectError
    .insert({ id: 10 }, 'id')
    .returning(['id', 'age']);

  await knexInstance('users_composite')
    // $ExpectError
    .insert({}, 'id')
    .returning(['id', 'age']);

  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance('users_composite')
    .insert({ insert: 'insert' }, 'id')
    .returning(['id', 'age']);

  // $ExpectType any[]
  await knexInstance('users')
    .insert({id: 10})
    .returning('*');

  // $ExpectType User[]
  await knexInstance<User>('users')
    .insert({id: 10})
    .returning('*');

  // $ExpectType User[]
  await knexInstance('users_inferred')
    .insert({id: 10})
    .returning('*');

  await knexInstance('users_composite')
    // $ExpectError
    .insert({id: 10})
    .returning('*');

  await knexInstance('users_composite')
    // $ExpectError
    .insert({})
    .returning('*');

  // $ExpectType User[]
  await knexInstance('users_composite')
    .insert({insert: 'insert'})
    .returning('*');

  // $ExpectType any[]
  await knexInstance
    .insert({id: 10})
    .into('users')
    .returning('*');

  // $ExpectType User[]
  await knexInstance
    .insert({id: 10})
    .into<User>('users')
    .returning('*');

  // $ExpectType User[]
  await knexInstance
    .insert({id: 10})
    .into('users_inferred')
    .returning('*');

  // $ExpectType User[]
  await knexInstance
    .insert({insert: 'insert'})
    .into('users_composite')
    .returning('*');

  // $ExpectType User[]
  await knexInstance
    .insert({id: 10})
    .returning('*')
    .into<User>('users');

  // $ExpectType User[]
  await knexInstance
    .insert({id: 10})
    .returning('*')
    .into('users_inferred');

  // $ExpectType User[]
  await knexInstance
    .insert({id: 10})
    .returning('*')
    .into('users_composite');

  // $ExpectType User[]
  await knexInstance<User>('users')
    .insert({id: 10}, 'id')
    .returning('*');

  // $ExpectType User[]
  await knexInstance('users_inferred')
    .insert({id: 10}, 'id')
    .returning('*');

  await knexInstance('users_composite')
    // $ExpectError
    .insert({id: 10}, 'id')
    .returning('*');

  await knexInstance('users_composite')
    // $ExpectError
    .insert({}, 'id')
    .returning('*');

  // $ExpectType User[]
  await knexInstance('users_composite')
    .insert({insert: 'insert'}, 'id')
    .returning('*');

  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance
    .insert({ id: 10 })
    .returning(['id', 'age'])
    .into<User>('users');

  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance
    .insert({ id: 10 })
    .returning(['id', 'age'])
    .into('users_inferred');

  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance
    .insert({ id: 10 })
    .returning(['id', 'age'])
    .into('users_composite');

  // $ExpectType any[]
  await knexInstance('users')
    .insert({ id: 10 })
    .returning(['id', 'age']);

  // # Update

  // $ExpectType number
  await knexInstance('users')
    .where('id', 10)
    .update({ active: true });

  const qb1 = knexInstance('users').where('id', 10);
  qb1.returning(['id', 'name']);
  // $ExpectType Partial<User>[]
  await qb1.update<Partial<User>[]>({ active: true });

  // $ExpectType number
  await knexInstance<User>('users')
    .where('id', 10)
    .update({ active: true });

  // $ExpectType number
  await knexInstance('users_inferred')
    .where('id', 10)
    .update({ active: true });

  // $ExpectType number
  await knexInstance('users_composite')
    .where('id', 10)
    .update({ update: 'update' });

  await knexInstance('users_composite')
    // $ExpectError
    .update({ id: 10 });

  await knexInstance('users_composite')
    // $ExpectError
    .update({});

  // $ExpectType number
  await knexInstance
    .where('id', 10)
    .update({ active: true })
    .from('users');

  // ## With Returning

  // $ExpectType any[]
  await knexInstance('users')
    .where('id', 10)
    .update({ active: true })
    .returning(['id', 'age']);

  // $ExpectType any[]
  await knexInstance('users')
    .where('id', 10)
    .update({ active: true })
    .returning('*');

  // $ExpectType User[]
  await knexInstance<User>('users')
    .where('id', 10)
    .update({ active: true })
    .returning('*');

  // $ExpectType User[]
  await knexInstance('users_inferred')
    .where('id', 10)
    .update({ active: true })
    .returning('*');

  // $ExpectType User[]
  await knexInstance('users_composite')
    .where('id', 10)
    // $ExpectError
    .update({})
    .returning('*');

  // $ExpectType User[]
  await knexInstance('users_composite')
    .where('id', 10)
    .update({ update: 'update' })
    .returning('*');

  // $ExpectType any[]
  await knexInstance
    .where('id', 10)
    .update({ active: true })
    .returning('*')
    .from('users');

  // $ExpectType User[]
  await knexInstance
    .where('id', 10)
    .update({ active: true })
    .returning('*')
    .from<User>('users');

  // $ExpectType User[]
  await knexInstance
    .where('id', 10)
    .update({ active: true })
    .returning('*')
    .from('users_inferred');

  // $ExpectType User[]
  await knexInstance
    .where('id', 10)
    .update({ update: 'update' })
    .returning('*')
    .from('users_composite');

  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance<User>('users')
    .where('id', 10)
    .update({ active: true })
    .returning(['id', 'age']);

  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance('users_inferred')
    .where('id', 10)
    .update({ active: true })
    .returning(['id', 'age']);

  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance('users_composite')
    .where('id', 10)
    .update({ update: 'update' })
    .returning(['id', 'age']);

  await knexInstance('users_composite')
    .where('id', 10)
    // $ExpectError
    .update({ id: 11 })
    .returning(['id', 'age']);

  await knexInstance('users_composite')
    .where('id', 10)
    // $ExpectError
    .update({})
    .returning(['id', 'age']);

  // $ExpectType number[]
  await knexInstance<User>('users')
    .where('id', 10)
    .update({ active: true }, 'id');

  // $ExpectType number[]
  await knexInstance('users_inferred')
    .where('id', 10)
    .update({ active: true }, 'id');

  // $ExpectType number[]
  await knexInstance('users_composite')
    .where('id', 10)
    .update({ update: 'update' }, 'id');

  await knexInstance('users_composite')
    .where('id', 10)
    // $ExpectError
    .update({ id: 11 }, 'id');

  await knexInstance('users_composite')
    .where('id', 10)
    // $ExpectError
    .update({}, 'id');

  // $ExpectType number[]
  await knexInstance<User>('users')
    .where('id', 10)
    .update('active', true, 'id');

  // $ExpectType number[]
  await knexInstance('users_inferred')
    .where('id', 10)
    .update('active', true, 'id');

  // $ExpectType number[]
  await knexInstance('users_composite')
    .where('id', 10)
    .update('update', 'update', 'id');

  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance<User>('users')
    .where('id', 10)
    .update({ active: true }, ['id', 'age']);

  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance('users_inferred')
    .where('id', 10)
    .update({ active: true }, ['id', 'age']);

  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance('users_composite')
    .where('id', 10)
    .update({ update: 'update' }, ['id', 'age']);

  await knexInstance('users_composite')
    .where('id', 10)
    // $ExpectError
    .update({ id: 11 }, ['id', 'age']);

  await knexInstance('users_composite')
    .where('id', 10)
    // $ExpectError
    .update({}, ['id', 'age']);

  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance<User>('users')
    .where('id', 10)
    .update('active', true, ['id', 'age']);

  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance('users_inferred')
    .where('id', 10)
    .update('active', true, ['id', 'age']);

  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance('users_composite')
    .where('id', 10)
    .update('update', 'update', ['id', 'age']);

  const userUpdateReturnCols = ['id', 'age'] as const;
  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance<User>('users')
    .where('id', 10)
    .update({ active: true }, userUpdateReturnCols);

  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance('users_inferred')
    .where('id', 10)
    .update({ active: true }, userUpdateReturnCols);

  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance('users_composite')
    .where('id', 10)
    .update({ update: 'update' }, userUpdateReturnCols);

  await knexInstance('users_composite')
    .where('id', 10)
    // $ExpectError
    .update({ id: 11 }, userUpdateReturnCols);

  await knexInstance('users_composite')
    .where('id', 10)
    // $ExpectError
    .update({}, userUpdateReturnCols);

  // TODO: .update('active', true', ['id', 'age']) does not works correctly
  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance
    .where('id', 10)
    .update({ active: true }, ['id', 'age'])
    .into<User>('users');

  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance
    .where('id', 10)
    .update({ active: true }, ['id', 'age'])
    .into('users_inferred');

  // $ExpectType Pick<User, "id" | "age">[]
  await knexInstance
    .where('id', 10)
    .update({ update: 'update' }, ['id', 'age'])
    .into('users_composite');

  // # Insert onConflict
  await knexInstance
    .table<User>('users')
    .insert({ id: 10, active: true })
    .onConflict('id')
    .merge({ active: true })
    .returning('*');

  // # Regression test (https://github.com/knex/knex/issues/4101)
  // # Ensure that .debug() can be called on a query containing an onConflict clause.
  await knexInstance
    .table<User>('users')
    .insert({ id: 10, active: true })
    .onConflict('id')
    .merge({ active: true })
    .debug(true);

  // # Deletion
  // $ExpectType number
  await knexInstance<User>('users')
    .where('id', 10)
    .delete();

  // $ExpectType number
  await knexInstance('users_inferred')
    .where('id', 10)
    .delete();

  // $ExpectType number
  await knexInstance('users_composite')
    .where('id', 10)
    .delete();

  // $ExpectType number
  await knexInstance<User>('users')
    .where('id', 10)
    .del();

  // $ExpectType number
  await knexInstance('users_inferred')
    .where('id', 10)
    .del();

  // $ExpectType number
  await knexInstance('users_composite')
    .where('id', 10)
    .del();

  // $ExpectType number[]
  await knexInstance<User>('users')
    .where('id', 10)
    .delete('id');

  // $ExpectType number[]
  await knexInstance('users_inferred')
    .where('id', 10)
    .delete('id');

  // $ExpectType number[]
  await knexInstance('users_composite')
    .where('id', 10)
    .delete('id');

  // $ExpectType any[]
  await knexInstance('users')
    .where('id', 10)
    .del()
    .returning('*');

  // $ExpectType any[]
  await knexInstance('users')
    .where('id', 10)
    .delete()
    .returning('*');

  // $ExpectType User[]
  await knexInstance<User>('users')
    .where('id', 10)
    .del()
    .returning('*');

  // $ExpectType User[]
  await knexInstance('users_inferred')
    .where('id', 10)
    .del()
    .returning('*');

  // $ExpectType User[]
  await knexInstance('users_composite')
    .where('id', 10)
    .del()
    .returning('*');

  // $ExpectType User[]
  await knexInstance<User>('users')
    .where('id', 10)
    .delete()
    .returning('*');

  // $ExpectType User[]
  await knexInstance('users_inferred')
    .where('id', 10)
    .delete()
    .returning('*');

  // $ExpectType User[]
  await knexInstance('users_composite')
    .where('id', 10)
    .delete()
    .returning('*');

  // $ExpectType User[]
  await knexInstance
    .where('id', 10)
    .del()
    .returning('*')
    .from<User>('users');

  // $ExpectType User[]
  await knexInstance
    .where('id', 10)
    .del()
    .returning('*')
    .from('users_inferred');

  // $ExpectType User[]
  await knexInstance
    .where('id', 10)
    .del()
    .returning('*')
    .from('users_composite');

  // $ExpectType User[]
  await knexInstance
    .where('id', 10)
    .delete()
    .returning('*')
    .from<User>('users');

  // $ExpectType User[]
  await knexInstance
    .where('id', 10)
    .delete()
    .returning('*')
    .from('users_inferred');

  // $ExpectType User[]
  await knexInstance
    .where('id', 10)
    .delete()
    .returning('*')
    .from('users_composite');

  // $ExpectType number[]
  await knexInstance
    .where('id', 10)
    .delete('id')
    .from<User>('users');

  // $ExpectType number[]
  await knexInstance
    .where('id', 10)
    .delete('id')
    .from('users_inferred');

  // $ExpectType number[]
  await knexInstance
    .where('id', 10)
    .delete('id')
    .from('users_composite');

  // $ExpectType void
  await knexInstance<User>('users').truncate();

  // $ExpectType void
  await knexInstance('users_inferred').truncate();

  // $ExpectType void
  await knexInstance('users_composite').truncate();

  // $ExpectType void
  await knexInstance('users').truncate();

  // # Column Info:

  // $ExpectType ColumnInfo
  await knexInstance('users').columnInfo();

  // $ExpectType ColumnInfo
  await knexInstance<User>('users').columnInfo();

  // $ExpectType ColumnInfo
  await knexInstance('users_inferred').columnInfo();

  // $ExpectType ColumnInfo
  await knexInstance('users_composite').columnInfo();

  // # Modify:

  function withUserName(queryBuilder: Knex.QueryBuilder, foreignKey: string) {
    queryBuilder
      .leftJoin('users', foreignKey, 'users.id')
      .select('users.user_name');
  }

  // $ExpectType QueryBuilder<any, any>
  knexInstance
    .table('articles')
    .select('title', 'body')
    .modify(withUserName, 'articles_user.id');

  const withAge = (queryBuilder: Knex.QueryBuilder<User, any[]>) =>
    queryBuilder.select('age');

  // $ExpectType Pick<User, "id" | "age">
  await knexInstance
    .table<User>('users')
    .select('id')
    .modify<User, Pick<User, 'id' | 'age'>>(withAge);

  // With:

  // $ExpectType any[]
  await knexInstance
    .with('with_alias', knexInstance.raw('select * from "users" where "id" = ?', 1))
    .select('*')
    .from('with_alias');

  // $ExpectType any[]
  await knexInstance
    .with(
      'with_alias',
      knexInstance.raw<User[]>('select * from "users" where "id" = ?', 1)
    )
    .select('*')
    .from('with_alias');

  // $ExpectType User[]
  await knexInstance
    .with(
      'with_alias',
      knexInstance.raw<User[]>('select * from "users" where "id" = ?', 1)
    )
    .select('*')
    .from<User>('with_alias');

  // $ExpectType any[]
  await knexInstance
    .with('with_alias', (qb) => {
      qb.select('*')
        .from('books')
        .where('author', 'Test');
    })
    .select('*')
    .from('with_alias');

  // $ExpectType any[]
  await knexInstance
    .withRecursive('ancestors', (qb) => {
      qb.select('*')
        .from('users')
        .where('users.id', 1);
    })
    .select('*')
    .from('ancestors');

  // $ExpectType any[]
  await knexInstance
    .withRecursive('ancestors', (qb) => {
      qb.select('*')
        .from<User>('users')
        .where('users.id', 1);
    })
    .select('*')
    .from('ancestors');

  // $ExpectType User[]
  await knexInstance
    .withRecursive('ancestors', (qb) => {
      qb.select('*')
        .from<User>('users')
        .where('users.id', 1);
    })
    .select('*')
    .from<User>('ancestors');

  // $ExpectType User[]
  await knexInstance
    .withRecursive('ancestors', (qb: Knex.QueryBuilder<User, User[]>) => {
      qb.select('*')
        .from<User>('users')
        .where('users.id', 1);
    })
    .select('*')
    .from<User>('ancestors');

  // $ExpectType Pick<User, "name" | "id">[]
  await knexInstance
    .withRecursive('ancestors', (qb) => {
      qb.select('*')
        .from<User>('users')
        .where('users.id', 1);
    })
    .select('id', 'name')
    .from<User>('ancestors');

  // $ExpectType any[]
  await knexInstance
    .withSchema('public')
    .select('*')
    .from('users');

  // $ExpectType User[]
  await knexInstance
    .withSchema('public')
    .select('*')
    .from<User>('users');

  // Seed:

  // $ExpectType string
  await knexInstance.seed.make('test');

  // $ExpectType string
  await knexInstance.seed.make('test', {
      extension: 'ts',
      directory: 'lib/seeds'
  });

  // $ExpectType [string[]]
  await knexInstance.seed.run();

  // $ExpectType [string[]]
  await knexInstance.seed.run({
      extension: 'ts',
      directory: 'lib/seeds'
  });

  // $ExpectType any[]
  await knexInstance('users', { only: true });

  // $ExpectType any[]
  await knexInstance
    .select('*')
    .from('users', { only: true });

  // $ExpectType any
  knexInstance.queryBuilder().queryContext();

  // .raw() support

  // $ExpectType User[]
  await knexInstance<User>('users')
    .where({
      id: knexInstance.raw<number>('a')
    });

  // $ExpectType User[]
  await knexInstance<User>('users')
    .where('id', knexInstance.raw<string>('a'));

  // $ExpectType Ticket[]
  await knexInstance<Ticket>('users')
    .where({
      at: knexInstance.fn.now()
    });

  // $ExpectType User[]
  await knexInstance<User>('users')
    // we can't do anything here for now
    .where('id', knexInstance.raw<string>('string'));

  // $ExpectType number[]
  await knexInstance<User>('users')
    .insert({
      id: knexInstance.raw<number>('a')
    });

  // $ExpectType User[]
  await knexInstance<User>('users')
    .insert([{
      id: knexInstance.raw<number>('a')
    }], '*');

  // $ExpectType number[]
  await knexInstance<User>('users')
    .update({
      id: knexInstance.raw<number>('a')
    }, 'id');

  // $ExpectType string[]
  await knexInstance<User>('users')
    .update<'active', 'name'>('active', knexInstance.raw<boolean>('true'), 'name');

  // $ExpectType Pick<User, "name">[]
  await knexInstance<User>('users')
    .update<'active', 'name'>('active', knexInstance.raw<boolean>('true'), ['name']);
};

class ExcelClient extends knex.Client { }
