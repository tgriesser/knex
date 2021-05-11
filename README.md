# [knex.js](http://knexjs.org)

[![npm version](http://img.shields.io/npm/v/knex.svg)](https://npmjs.org/package/knex)
[![npm downloads](https://img.shields.io/npm/dm/knex.svg)](https://npmjs.org/package/knex)
![](https://github.com/knex/knex/workflows/CI/badge.svg)
[![Coverage Status](https://coveralls.io/repos/knex/knex/badge.svg?branch=master)](https://coveralls.io/r/knex/knex?branch=master)
[![Dependencies Status](https://david-dm.org/knex/knex.svg)](https://david-dm.org/knex/knex)
[![Gitter chat](https://badges.gitter.im/tgriesser/knex.svg)](https://gitter.im/tgriesser/knex)
[![Language Grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/knex/knex.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/knex/knex/context:javascript)

> **A SQL query builder that is _flexible_, _portable_, and _fun_ to use!**

A batteries-included, multi-dialect (MSSQL, MySQL, PostgreSQL, SQLite3, Oracle (including Oracle Wallet Authentication)) query builder for
Node.js, featuring:

- [transactions](https://knexjs.org/#Transactions)
- [connection pooling](https://knexjs.org/#Installation-pooling)
- [streaming queries](https://knexjs.org/#Interfaces-Streams)
- both a [promise](https://knexjs.org/#Interfaces-Promises) and [callback](https://knexjs.org/#Interfaces-Callbacks) API
- a [thorough test suite](https://github.com/knex/knex/actions)

Node.js versions 10+ are supported.

* Take a look at the [full documentation](https://knexjs.org) to get started!
* Browse the [list of plugins and tools](https://github.com/knex/knex/blob/master/ECOSYSTEM.md) built for knex
* Check out our [recipes wiki](https://github.com/knex/knex/wiki/Recipes) to search for solutions to some specific problems  
* In case of upgrading from an older version, see [migration guide](https://github.com/knex/knex/blob/master/UPGRADING.md)

You can report bugs and discuss features on the [GitHub issues page](https://github.com/knex/knex/issues) or send tweets to [@kibertoad](http://twitter.com/kibertoad).


For support and questions, join our [Gitter channel](https://gitter.im/tgriesser/knex).

For knex-based Object Relational Mapper, see:

- https://github.com/Vincit/objection.js
- https://github.com/mikro-orm/mikro-orm
- https://bookshelfjs.org

To see the SQL that Knex will generate for a given query, you can use [Knex Query Lab](https://michaelavila.com/knex-querylab/)

## Examples

We have several examples [on the website](http://knexjs.org). Here is the first one to get you started:

```js
const knex = require('knex')({
  client: 'sqlite3',
  connection: {
    filename: './data.db',
  },
});

try {

  // Create a table
  await knex.schema
    .createTable('users', table => {
      table.increments('id');
      table.string('user_name');
    })
    // ...and another
    .createTable('accounts', table => {
      table.increments('id');
      table.string('account_name');
      table
        .integer('user_id')
        .unsigned()
        .references('users.id');
    })

  // Then query the table...
  const insertedRows = await knex('users').insert({ user_name: 'Tim' })

  // ...and using the insert id, insert into the other table.
  await knex('accounts').insert({ account_name: 'knex', user_id: insertedRows[0] })

  // Query both of the rows.
  const selectedRows = await knex('users')
    .join('accounts', 'users.id', 'accounts.user_id')
    .select('users.user_name as user', 'accounts.account_name as account')

  // map over the results
  const enrichedRows = selectedRows.map(row => ({ ...row, active: true }))

  // Finally, add a catch statement
} catch(e) {
  console.error(e);
};
```

## TypeScript example
```ts
import { Knex, knex } from 'knex'

interface User {
  id: number;
  age: number;
  name: string;
  active: boolean;
  departmentId: number;
}

const config: Knex.Config = {
  client: 'sqlite3',
  connection: {
    filename: './data.db',
  },
}

const knexInstance = knex(config);

try {
  const users = await knex<User>('users').select('id', 'age');
} catch (err) {
  // error handling
}
```

## Usage as ESM module

If you are launching your Node application with `--experimental-modules`, `knex.mjs` should be picked up automatically and named ESM import should work out-of-the-box.
Otherwise, if you want to use named imports, you'll have to import knex like this:
```js
import { knex } from 'knex/knex.mjs'
```

You can also just do the default import:
```js
import knex from 'knex'
```

If you are not using TypeScript and would like the IntelliSense of your IDE to work correctly, it is recommended to set the type explicitly:
```js
/**
 * @type {Knex}
 */
const database = knex({
    client: 'mysql',
    connection: {
      host : '127.0.0.1',
      user : 'your_database_user',
      password : 'your_database_password',
      database : 'myapp_test'
    }
  });
database.migrate.latest();
```
