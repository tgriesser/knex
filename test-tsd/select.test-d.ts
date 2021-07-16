import Knex from '../types';
import { clientConfig, User } from './common';
import { expectType } from 'tsd';

const knex = Knex(clientConfig);

const main = async () => {
  expectType<any[]>(await knex('users').select('id').select('age'));

  expectType<any>(await knex('users').select('id').select('age').first());

  expectType<any>(await knex('users').first('id'));

  expectType<any>(
    await knex.first('*').from('table').where({
      whatever: 'whatever',
    })
  );

  expectType<any>(await knex('users').first('id', 'name'));

  expectType<User>(await knex('users').first('id', 'name'));

  expectType<any>(await knex('users').first(knex.ref('id').as('identifier')));

  expectType<Pick<User, 'id'> | undefined>(
    await knex<User>('users').first('id')
  );
  expectType<Pick<User, 'id' | 'name'> | undefined>(
    await knex<User>('users').first('id', 'name')
  );

  expectType<{ identifier: number } | undefined>(
    await knex<User>('users').first(knex.ref('id').as('identifier'))
  );

  expectType<{ id: number; name: string }[]>(
    await knex<User>('users').select([knex.ref('name'), knex.ref('id')])
  );

  expectType<{ id: number; name: string }[]>(
    await knex('users_inferred').select([knex.ref('name'), knex.ref('id')])
  );

  expectType<{ id: number; name: string }[]>(
    await knex('users_composite').select([knex.ref('name'), knex.ref('id')])
  );

  expectType<Pick<User, 'id'> | undefined>(
    await knex.first('id').from<User>('users')
  );
  expectType<Pick<User, 'id' | 'name'> | undefined>(
    await knex.first('id', 'name').from<User>('users')
  );

  expectType<{ identifier: number } | undefined>(
    await knex.first(knex.ref('id').as('identifier')).from<User>('users')
  );

  expectType<Pick<User, 'id'>[]>(await knex<User>('users').select('id'));

  expectType<Pick<User, 'id' | 'age'>[]>(
    await knex<User>('users').select('id').select('age')
  );

  expectType<Pick<User, 'id' | 'age'>[]>(
    await knex<User>('users').select('id', 'age')
  );

  knex.transaction(async trx => {
    expectType<User[]>(await trx.select('*').from('users'));
  });
};
