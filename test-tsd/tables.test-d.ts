import { knex, Knex } from '../types';
import { clientConfig, User, Department, Article } from './common';
import { expectType } from 'tsd';

const knexInstance = knex(clientConfig);

declare module '../types/tables' {
  interface Tables {
    users_inferred: User;
    departments_inferred: Department;
    articles_inferred: Article;
    users_composite: Knex.CompositeTableType<
      User,
      { insert: 'insert' },
      { update: 'update' }
    >;
    departments_composite: Knex.CompositeTableType<
      Department,
      { insert: 'insert' },
      { update: 'update' }
    >;
    articles_composite: Knex.CompositeTableType<
      Article,
      { insert: 'insert' },
      { update: 'update' }
    >;
  }
}

const main = async () => {
  // # Select:

  expectType<any[]>(await knexInstance('users'));

  // This test (others similar to it) may seem useless but they are needed
  // to test for left-to-right inference issues eg: #3260
  expectType<User[]>(await knexInstance('users'));
  expectType<User[]>(await knexInstance<User>('users'));
  expectType<User[]>(await knexInstance('users_inferred'));
  expectType<User[]>(await knexInstance('users_composite'));

  expectType<any[]>(await knexInstance('users').select('id'));
  expectType<Partial<User>[]>(await knexInstance('users').select('id'));

  expectType<Pick<User, 'id'>[]>(await knexInstance('users_inferred').select('id'));
  expectType<Pick<User, 'id'>[]>(await knexInstance('users_composite').select('id'));
  expectType<Pick<User, 'id' | 'age'>[]>(
    await knexInstance('users_inferred').select('id').select('age')
  );

  expectType<Pick<User, 'id' | 'age'>[]>(
    await knexInstance('users_composite').select('id').select('age')
  );

  expectType<Pick<User, 'id' | 'age'>[]>(
    await knexInstance('users_inferred').select('id', 'age')
  );
  expectType<Pick<User, 'id' | 'age'>[]>(
    await knexInstance('users_composite').select('id', 'age')
  );

  expectType<Pick<User, 'id'> | undefined>(
    await knexInstance.first('id').from('users_inferred')
  );
  expectType<Pick<User, 'id'> | undefined>(
    await knexInstance.first('id').from('users_composite')
  );
};
