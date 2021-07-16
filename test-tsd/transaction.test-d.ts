import knexDefault, { Knex } from '../types';
import { clientConfig, Article } from './common';
import { expectType } from 'tsd';

const knexInstance = knexDefault(clientConfig);

const main = async () => {
  // # Select:

  expectType<Knex.TransactionProvider>(knexInstance.transactionProvider())

  expectType<any[]>(await knexInstance.transaction((trx) => {
    return trx.insert({ name: 'Old Books' }, 'id').into('articles');
  }));

  expectType<Pick<Article, "id" | "subject">[]>(await knexInstance.transaction((trx) => {
    const articles: Article[] = [
      { id: 1, subject: 'Canterbury Tales' },
      { id: 2, subject: 'Moby Dick' },
      { id: 3, subject: 'Hamlet' },
    ];
    return trx
      .insert(articles)
      .into<Article>('articles')
      .returning(['id', 'subject']);
  }));

  expectType<Article[]>(await knexInstance.transaction((trx) => {
    return trx
      .select('*')
      .from<Article>('articles');
  }));

  expectType<Pick<Article, "id" | "subject">[]> (await knexInstance.transaction((trx) => {
    const articles = [
      { id: 1, subject: 'Canterbury Tales' },
      { id: 2, subject: 'Moby Dick' },
      { id: 3, subject: 'Hamlet' },
    ] as const;
    return trx
      .insert(articles)
      .into<Article>('articles')
      .returning(['id', 'subject']);
  }));

  expectType<any[]> (await knexInstance.transaction(async (trx) => {
    const articles: Article[] = [
      { id: 1, subject: 'Canterbury Tales' },
      { id: 2, subject: 'Moby Dick' },
      { id: 3, subject: 'Hamlet' },
    ];
    return knexInstance
      .insert(articles, ['id', 'subject'])
      .into<Article>('articles')
      .transacting(trx)
      .then(trx.commit)
      .catch(trx.rollback);
  }));

  expectType<any[]>(await knexInstance.transaction(async (trx) => {
    const articles: ReadonlyArray<Article> = [
      { id: 1, subject: 'Canterbury Tales' },
      { id: 2, subject: 'Moby Dick' },
      { id: 3, subject: 'Hamlet' },
    ];
    return knexInstance
      .insert(articles, ['id', 'subject'])
      .into<Article>('articles')
      .transacting(trx)
      .then(trx.commit)
      .catch(trx.rollback);
  }));

  expectType<Pick<Article, "id" | "subject">[]> (await knexInstance.transaction(
    async (
      trx: Knex.Transaction<Article, Pick<Article, 'id' | 'subject'>[]>
    ) => {
      const articles: Article[] = [
        { id: 1, subject: 'Canterbury Tales' },
        { id: 2, subject: 'Moby Dick' },
        { id: 3, subject: 'Hamlet' },
      ];
      return knexInstance
        .insert(articles, ['id', 'subject'])
        .into<Article>('articles')
        .transacting(trx)
        .then(trx.commit)
        .catch(trx.rollback);
    }
  ));

  const transactionConfig: Knex.TransactionConfig = {
    isolationLevel: 'serializable',
    userParams: {},
    doNotRejectOnRollback: true,
    connection: {}
  }
  expectType<Knex.TransactionConfig>(transactionConfig)
}
