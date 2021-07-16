#!/usr/bin/env jake
'use strict';
/* eslint-disable no-undef */

const os = require('os');
const fs = require('fs');
const rimrafSync = require('rimraf').sync;
const path = require('path');
const sqlite3 = require('sqlite3');
const { assert } = require('chai');
const { promisify } = require('util');
const { assertExec, assertExecError } = require('../../jake-util/helpers/migration-test-helper');
const knexfile = require('../../jake-util/knexfile/knexfile.js');

const KNEX = path.normalize(__dirname + '/../../../bin/cli.js');

/* * * HELPERS * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

const taskList = [];
function test(description, func) {
  const tmpDirPath = os.tmpdir() + '/knex-test-';
  let itFails = false;
  rimrafSync(tmpDirPath);
  const tempFolder = fs.mkdtempSync(tmpDirPath);
  fs.mkdirSync(tempFolder + '/migrations');
  desc(description);
  const taskName = description.replace(/[^a-z0-9]/g, '');
  taskList.push(taskName);
  task(taskName, { async: true }, () =>
    func(tempFolder)
      .then(() => console.log('☑ ' + description))
      .catch((err) => {
        console.log('☒ ' + err.message);
        itFails = true;
      })
      .then(() => {
        jake.exec(`rm -r ${tempFolder}`);
        if (itFails) {
          process.exit(1);
        }
      })
  );
}

/* * * TESTS * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

test('Create a migration file', (temp) =>
  assertExec(`${KNEX} migrate:make \
               --client=sqlite3 \
               --migrations-directory=${temp}/migrations \
               create_rule_table`)
    .then(() =>
      assertExec(
        `ls ${temp}/migrations/*_create_rule_table.js`,
        'Find the migration file'
      )
    )
    .then(() =>
      assertExec(
        `grep exports.up ${temp}/migrations/*_create_rule_table.js`,
        'Migration created with boilerplate'
      )
    ));

test('Create a migration file without client passed', (temp) =>
  assertExec(`${KNEX} migrate:make \
               --migrations-directory=${temp}/migrations \
               create_rule_table`)
    .then(() =>
      assertExec(
        `ls ${temp}/migrations/*_create_rule_table.js`,
        'Find the migration file'
      )
    )
    .then(() =>
      assertExec(
        `grep exports.up ${temp}/migrations/*_create_rule_table.js`,
        'Migration created with boilerplate'
      )
    ));

test('run migrations without knexfile and with --migrations-table-name', (temp) =>
  assertExec(`${KNEX} migrate:latest \
              --client=sqlite3  --connection=${temp}/db \
              --migrations-directory=test/jake-util/knexfile_migrations \
              --migrations-table-name=custom_migrations_table`)
    .then(() => new sqlite3.Database(temp + '/db'))
    .then(
      (db) =>
        new Promise((resolve, reject) =>
          db.get(
            "SELECT name FROM sqlite_master where type='table' AND name='custom_migrations_table'",
            function (err, row) {
              err ? reject(err) : resolve(row);
            }
          )
        )
    )
    .then((row) => assert.equal(row.name, 'custom_migrations_table')));

test('migrate:latest prints non verbose logs', (temp) => {
  const db = knexfile.connection.filename;
  if (fs.existsSync(db)) {
    fs.unlinkSync(db);
  }

  return assertExec(
    `node ${KNEX} migrate:latest --knexfile=test/jake-util/knexfile/knexfile.js --knexpath=../knex.js`
  ).then(({ stdout }) => {
    assert.include(stdout, 'Batch 1 run: 1 migrations');
    assert.notInclude(stdout, 'simple_migration.js');
  });
});

test('migrate:rollback prints non verbose logs', (temp) => {
  return assertExec(
    `node ${KNEX} migrate:rollback --knexfile=test/jake-util/knexfile/knexfile.js --knexpath=../knex.js`
  ).then(({ stdout }) => {
    assert.include(stdout, 'Batch 1 rolled back: 1 migrations');
    assert.notInclude(stdout, 'simple_migration.js');
  });
});

test('migrate:latest prints verbose logs', (temp) => {
  return assertExec(
    `node ${KNEX} migrate:latest --knexfile=test/jake-util/knexfile/knexfile.js --knexpath=../knex.js --verbose`
  ).then(({ stdout }) => {
    assert.include(stdout, 'Batch 1 run: 1 migrations');
    assert.include(stdout, 'simple_migration.js');
  });
});

test('migrate:rollback prints verbose logs', (temp) => {
  return assertExec(
    `node ${KNEX} migrate:rollback --knexfile=test/jake-util/knexfile/knexfile.js --knexpath=../knex.js --verbose`
  ).then(({ stdout }) => {
    assert.include(stdout, 'Batch 1 rolled back: 1 migrations');
    assert.include(stdout, 'simple_migration.js');
  });
});

test('migrate:rollback --all rolls back all completed migrations', (temp) => {
  const migrationFile1 = '001_create_users_table.js';
  const migrationFile2 = '002_add_age_column_to_users_table.js';
  const migrationFile3 = '003_add_last_name_column_to_users_table.js';
  const migrationFile4 = '004_add_email_to_users_table.js';

  fs.writeFileSync(
    `${temp}/migrations/${migrationFile1}`,
    `
      exports.up = (knex) => knex.schema
        .createTable('users', (table) => {
          table.string('first_name');
        });

      exports.down = (knex) => knex.schema.dropTable('users');
    `
  );

  return assertExec(
    `node ${KNEX} migrate:latest \
    --client=sqlite3 \
    --connection=${temp}/db \
    --migrations-directory=${temp}/migrations`,
    'create_users_table'
  )
    .then(() => {
      fs.writeFileSync(
        `${temp}/migrations/${migrationFile2}`,
        `
          exports.up = (knex) => knex.schema
            .table('users', (table) => {
              table.integer('age');
            });
    
          exports.down = (knex) => knex.schema
            .table('users', (table) => {
              table.dropColumn('age');
            });
        `
      );

      return assertExec(
        `node ${KNEX} migrate:latest \
        --client=sqlite3 \
        --connection=${temp}/db \
        --migrations-directory=${temp}/migrations`,
        'add_age_column_to_users_table'
      );
    })
    .then(() => {
      fs.writeFileSync(
        `${temp}/migrations/${migrationFile3}`,
        `
        exports.up = (knex) => knex.schema
          .table('users', (table) => {
            table.string('last_name');
          });
  
        exports.down = (knex) => knex.schema
          .table('users', (table) => {
            table.dropColumn('last_name');
          });
      `
      );

      return assertExec(
        `node ${KNEX} migrate:latest \
      --client=sqlite3 \
      --connection=${temp}/db \
      --migrations-directory=${temp}/migrations`,
        'add_last_name_column_to_user_table'
      );
    })
    .then(() => {
      fs.writeFileSync(
        `${temp}/migrations/${migrationFile4}`,
        `
        exports.up = (knex) => knex.schema
          .table('users', (table) => {
            table.string('email');
          });
  
        exports.down = (knex) => knex.schema
          .table('users', (table) => {
            table.dropColumn('email');
          });
      `
      );
    })
    .then(() => {
      const db = new sqlite3.Database(`${temp}/db`);

      return new Promise((resolve, reject) =>
        db.all('SELECT * FROM knex_migrations', (err, rows) => {
          const migrationsWithoutMigrationTime = rows.map((row) => {
            return {
              id: row.id,
              name: row.name,
              batch: row.batch,
            };
          });

          assert.includeDeepOrderedMembers(migrationsWithoutMigrationTime, [
            {
              id: 1,
              name: migrationFile1,
              batch: 1,
            },
            {
              id: 2,
              name: migrationFile2,
              batch: 2,
            },
            {
              id: 3,
              name: migrationFile3,
              batch: 3,
            },
          ]);

          err ? reject(err) : resolve(rows);
        })
      );
    })
    .then(() => {
      return assertExec(
        `node ${KNEX} migrate:rollback --all \
      --client=sqlite3 \
      --connection=${temp}/db \
      --migrations-directory=${temp}/migrations`
      ).then(({ stdout }) => {
        assert.include(stdout, 'Batch 3 rolled back: 3 migrations');
      });
    });
});

test('migrate:up runs only the next unrun migration', (temp) => {
  const migrationFile1 = '001_create_books_table.js';
  const migrationFile2 = '002_add_pages_column_to_books_table.js';

  fs.writeFileSync(
    `${temp}/migrations/${migrationFile1}`,
    `
      exports.up = (knex) => knex.schema
        .createTable('books', (table) => {
          table.string('title');
        });

      exports.down = (knex) => knex.schema.dropTable('books');
    `
  );

  fs.writeFileSync(
    `${temp}/migrations/${migrationFile2}`,
    `
      exports.up = (knex) => knex.schema
        .table('books', (table) => {
          table.integer('pages');
        });

      exports.down = (knex) => knex.schema
        .table('books', (table) => {
          table.dropColumn('pages');
        });
    `
  );

  return assertExec(
    `node ${KNEX} migrate:up \
    --client=sqlite3 \
    --connection=${temp}/db \
    --migrations-directory=${temp}/migrations`,
    'create_books_table'
  )
    .then(({ stdout }) => {
      assert.include(
        stdout,
        `Batch 1 ran the following migrations:\n${migrationFile1}`
      );

      const db = new sqlite3.Database(`${temp}/db`);

      return new Promise((resolve, reject) => {
        db.all('SELECT * FROM knex_migrations', (err, rows) => {
          const migrationsWithoutMigrationTime = rows.map((row) => {
            return {
              id: row.id,
              name: row.name,
              batch: row.batch,
            };
          });

          assert.includeDeepOrderedMembers(migrationsWithoutMigrationTime, [
            {
              id: 1,
              name: migrationFile1,
              batch: 1,
            },
          ]);

          err ? reject(err) : resolve(rows);
        });
      });
    })
    .then(() => {
      return assertExec(
        `node ${KNEX} migrate:up \
        --client=sqlite3 \
        --connection=${temp}/db \
        --migrations-directory=${temp}/migrations`,
        'update_books_table'
      ).then(({ stdout }) => {
        assert.include(
          stdout,
          `Batch 2 ran the following migrations:\n${migrationFile2}`
        );

        const db = new sqlite3.Database(`${temp}/db`);

        return new Promise((resolve, reject) => {
          db.all('SELECT * FROM knex_migrations', (err, rows) => {
            const migrationsWithoutMigrationTime = rows.map((row) => {
              return {
                id: row.id,
                name: row.name,
                batch: row.batch,
              };
            });

            assert.includeDeepOrderedMembers(migrationsWithoutMigrationTime, [
              {
                id: 1,
                name: migrationFile1,
                batch: 1,
              },
              {
                id: 2,
                name: migrationFile2,
                batch: 2,
              },
            ]);

            err ? reject(err) : resolve(rows);
          });
        });
      });
    })
    .then(() => {
      return assertExec(
        `node ${KNEX} migrate:up \
        --client=sqlite3 \
        --connection=${temp}/db \
        --migrations-directory=${temp}/migrations`,
        'already_up_to_date'
      ).then(({ stdout }) => {
        assert.include(stdout, 'Already up to date');
      });
    });
});

test('migrate:up <name> runs only the defined unrun migration', async (temp) => {
  const migrationsPath = `${temp}/migrations`;
  const migrationFile1 = '001_one.js';
  const migrationFile2 = '002_two.js';
  const migrationData = `
      exports.up = () => Promise.resolve();
      exports.down = () => Promise.resolve();
    `;

  fs.writeFileSync(`${migrationsPath}/${migrationFile1}`, migrationData);

  fs.writeFileSync(`${migrationsPath}/${migrationFile2}`, migrationData);

  const { stdout } = await assertExec(
    `node ${KNEX} migrate:up ${migrationFile2} \
    --client=sqlite3 \
    --connection=${temp}/db \
    --migrations-directory=${migrationsPath}`,
    'run_migration_002'
  );
  assert.include(
    stdout,
    `Batch 1 ran the following migrations:\n${migrationFile2}`
  );
  assert.notInclude(stdout, migrationFile1);
});

test('migrate:up <name> throw an error', async (temp) => {
  const migrationsPath = `${temp}/migrations`;
  const migrationFile1 = '001_one.js';

  const stderr = await assertExecError(
    `node ${KNEX} migrate:up ${migrationFile1} \
    --client=sqlite3 \
    --connection=${temp}/db \
    --migrations-directory=${migrationsPath}`,
    'run_migration_001'
  );
  assert.include(stderr, `Migration "${migrationFile1}" not found.`);
});

test('migrate:down undos only the last run migration', (temp) => {
  const migrationFile1 = '001_create_address_table.js';
  const migrationFile2 = '002_add_zip_to_address_table.js';

  fs.writeFileSync(
    `${temp}/migrations/${migrationFile1}`,
    `
      exports.up = (knex) => knex.schema
        .createTable('address', (table) => {
          table.string('street');
        });

      exports.down = (knex) => knex.schema.dropTable('address');
    `
  );

  fs.writeFileSync(
    `${temp}/migrations/${migrationFile2}`,
    `
      exports.up = (knex) => knex.schema
        .table('address', (table) => {
          table.integer('zip_code');
        });

      exports.down = (knex) => knex.schema
        .table('address', (table) => {
          table.dropColumn('zip_code');
        });
    `
  );

  return assertExec(
    `node ${KNEX} migrate:latest \
    --client=sqlite3 \
    --connection=${temp}/db \
    --migrations-directory=${temp}/migrations`,
    'run_all_migrations'
  )
    .then(() => {
      return assertExec(
        `node ${KNEX} migrate:down \
      --client=sqlite3 \
      --connection=${temp}/db \
      --migrations-directory=${temp}/migrations`,
        'undo_migration_002'
      ).then(({ stdout }) => {
        assert.include(
          stdout,
          `Batch 1 rolled back the following migrations:\n${migrationFile2}`
        );

        const db = new sqlite3.Database(`${temp}/db`);

        return new Promise((resolve, reject) => {
          db.all('SELECT * FROM knex_migrations', (err, rows) => {
            const migrationsWithoutMigrationTime = rows.map((row) => {
              return {
                id: row.id,
                name: row.name,
                batch: row.batch,
              };
            });

            assert.includeDeepOrderedMembers(migrationsWithoutMigrationTime, [
              {
                id: 1,
                name: migrationFile1,
                batch: 1,
              },
            ]);

            err ? reject(err) : resolve();
          });
        });
      });
    })
    .then(() => {
      return assertExec(
        `node ${KNEX} migrate:down \
      --client=sqlite3 \
      --connection=${temp}/db \
      --migrations-directory=${temp}/migrations`,
        'undo_migration_001'
      ).then(({ stdout }) => {
        assert.include(
          stdout,
          `Batch 1 rolled back the following migrations:\n${migrationFile1}`
        );

        const db = new sqlite3.Database(`${temp}/db`);

        return new Promise((resolve, reject) => {
          db.all('SELECT * FROM knex_migrations', (err, rows) => {
            assert.isEmpty(rows);

            err ? reject(err) : resolve();
          });
        });
      });
    })
    .then(() => {
      return assertExec(
        `node ${KNEX} migrate:down \
      --client=sqlite3 \
      --connection=${temp}/db \
      --migrations-directory=${temp}/migrations`,
        'already_at_the_base_migration'
      ).then(({ stdout }) => {
        assert.include(stdout, 'Already at the base migration');
      });
    });
});

test('migrate:down <name> undos only the defined run migration', async (temp) => {
  const migrationsPath = `${temp}/migrations`;
  const migrationFile1 = '001_one.js';
  const migrationFile2 = '002_two.js';
  const migrationData = `
      exports.up = () => Promise.resolve();
      exports.down = () => Promise.resolve();
    `;

  fs.writeFileSync(`${migrationsPath}/${migrationFile1}`, migrationData);
  fs.writeFileSync(`${migrationsPath}/${migrationFile2}`, migrationData);

  await assertExec(
    `node ${KNEX} migrate:latest \
    --client=sqlite3 \
    --connection=${temp}/db \
    --migrations-directory=${migrationsPath}`,
    'run_all_migrations'
  );
  const { stdout } = await assertExec(
    `node ${KNEX} migrate:down ${migrationFile1} \
      --client=sqlite3 \
      --connection=${temp}/db \
      --migrations-directory=${temp}/migrations`,
    'undo_migration_001'
  );
  assert.include(
    stdout,
    `Batch 1 rolled back the following migrations:\n${migrationFile1}`
  );
  assert.notInclude(stdout, migrationFile2);
});

test('migrate:down <name> throw an error', async (temp) => {
  const migrationsPath = `${temp}/migrations`;
  const migrationFile1 = '001_one.js';

  const stderr = await assertExecError(
    `node ${KNEX} migrate:down ${migrationFile1} \
    --client=sqlite3 \
    --connection=${temp}/db \
    --migrations-directory=${migrationsPath}`,
    'undo_migration_001'
  );
  assert.include(stderr, `Migration "${migrationFile1}" was not run.`);
});

test('migrate:list prints migrations both completed and pending', async (temp) => {
  const migrationFile1 = '001_create_animals_table.js';
  const migrationFile2 = '002_add_age_column_to_animals_table.js';

  const { stdout } = await assertExec(
    `node ${KNEX} migrate:list \
    --client=sqlite3 \
    --connection=${temp}/db \
    --migrations-directory=${temp}/migrations`
  );

  assert.include(stdout, `No Completed Migration files Found.`);
  assert.include(stdout, `No Pending Migration files Found.`);

  fs.writeFileSync(
    `${temp}/migrations/${migrationFile1}`,
    `
          exports.up = (knex) => knex.schema
            .createTable('animals', (table) => {
              table.string('title');
            });

          exports.down = (knex) => knex.schema.dropTable('animals');
        `
  );

  fs.writeFileSync(
    `${temp}/migrations/${migrationFile2}`,
    `
          exports.up = (knex) => knex.schema
            .table('animals', (table) => {
              table.integer('age');
            });

          exports.down = (knex) => knex.schema
            .table('animals', (table) => {
              table.dropColumn('age');
            });
        `
  );

  const migrationUp1Result = await assertExec(
    `node ${KNEX} migrate:up \
        --client=sqlite3 \
        --connection=${temp}/db \
        --migrations-directory=${temp}/migrations`,
    'create_animals_table'
  );

  assert.include(
    migrationUp1Result.stdout,
    `Batch 1 ran the following migrations:\n${migrationFile1}`
  );

  const migrationsListResult = await assertExec(
    `node ${KNEX} migrate:list \
      --client=sqlite3 \
      --connection=${temp}/db \
      --migrations-directory=${temp}/migrations`
  );

  assert.include(
    migrationsListResult.stdout,
    `Found 1 Completed Migration file/files.`
  );
  assert.include(
    migrationsListResult.stdout,
    `Found 1 Pending Migration file/files.`
  );

  const migrationUp2Result = await assertExec(
    `node ${KNEX} migrate:up \
        --client=sqlite3 \
        --connection=${temp}/db \
        --migrations-directory=${temp}/migrations`,
    'update_animals_table'
  );

  assert.include(
    migrationUp2Result.stdout,
    `Batch 2 ran the following migrations:\n${migrationFile2}`
  );

  const migrationsList2Result = await assertExec(
    `node ${KNEX} migrate:list \
          --client=sqlite3 \
          --connection=${temp}/db \
          --migrations-directory=${temp}/migrations`
  );

  assert.include(
    migrationsList2Result.stdout,
    `Found 2 Completed Migration file/files.`
  );
  assert.include(
    migrationsList2Result.stdout,
    `No Pending Migration files Found.`
  );
});

test('override connection, client and migrations-table-name if specified through cmd line arguments', async (temp) => {
  const { stdout } = await assertExec(`${KNEX} migrate:latest \
              --client=sqlite3  --connection=${temp}/db2 \
              --migrations-directory=test/jake-util/knexfile_migrations \
              --migrations-table-name=custom_migrations_table`);
  assert.include(
    stdout,
    `Using environment: development\nBatch 1 run: 1 migrations`
  );

  const db = await new sqlite3.Database(temp + '/db2');
  const sqlite3GetProm = promisify(db.get.bind(db));
  const row = await sqlite3GetProm(
    "SELECT name FROM sqlite_master where type='table' AND name='custom_migrations_table'"
  );
  assert.equal(row.name, 'custom_migrations_table');
});

module.exports = {
  taskList,
};
