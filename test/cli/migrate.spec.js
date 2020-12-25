'use strict';

const path = require('path');
const sqlite3 = require('sqlite3');
const { expect } = require('chai');
const { execCommand } = require('cli-testlab');
const { getRootDir, setupFileHelper } = require('./cli-test-utils');

const KNEX = path.normalize(__dirname + '/../../bin/cli.js');

describe('migrate:latest', () => {
  before(() => {
    process.env.KNEX_PATH = '../knex.js';
  });

  let fileHelper;
  const rootDir = getRootDir();
  const dbPath = path.resolve(rootDir, 'db');
  beforeEach(() => {
    fileHelper = setupFileHelper();
    fileHelper.registerForCleanup(dbPath);
  });
  afterEach(() => {
    fileHelper.cleanup();
  });

  it('Run migrations', async () => {
    fileHelper.createFile(
      'migrations/000_create_rule_table.js',
      `
            exports.up = (knex)=> knex.schema.createTable('rules', (table)=> {
                table.string('name');
            });
            exports.down = (knex)=> knex.schema.dropTable('rules');
        `,
      { willBeCleanedUp: true, isPathAbsolute: false }
    );

    expect(fileHelper.fileExists(dbPath)).to.equal(false);
    await execCommand(`node ${KNEX} migrate:latest \
                 --client=sqlite3 --connection=${dbPath} \
                 --migrations-directory=${rootDir}/migrations \
                 create_rule_table`);
    expect(fileHelper.fileExists(dbPath)).to.equal(true);
    const db = await new sqlite3.Database(dbPath);

    const getPromise = new Promise((resolve, reject) => {
      db.get('SELECT name FROM knex_migrations', {}, (err, row) => {
        if (err) {
          reject(err);
        }
        resolve(row);
      });
    });
    const row = await getPromise;
    expect(row.name).to.equal('000_create_rule_table.js');
    db.close();
  });

  it('CLI Options override knexfile', async () => {
    const path = process.cwd() + '/knexfile.js';
    fileHelper.createFile(
      path,
      `
module.exports = {
  client: 'sqlite3',
  connection: {
    filename: '${dbPath}',
  },
  migrations: {
    directory: __dirname + '/test//jake-util/knexfile_migrations',
  },
};
      `,
      { isPathAbsolute: true }
    );

    fileHelper.createFile(
      'migrations/subdirectory/000_create_rule_table.js',
      `
            exports.up = (knex)=> knex.schema.createTable('rules', (table)=> {
                table.string('name');
            });
            exports.down = (knex)=> knex.schema.dropTable('rules');
        `,
      { willBeCleanedUp: true, isPathAbsolute: false }
    );

    expect(fileHelper.fileExists(dbPath)).to.equal(false);
    await execCommand(`node ${KNEX} migrate:latest \
                 --knexpath=../knexfile.js \
                 --migrations-directory=${rootDir}/migrations/subdirectory/ \
                 create_rule_table`);
    expect(fileHelper.fileExists(dbPath)).to.equal(true);
    const db = await new sqlite3.Database(dbPath);

    const getPromise = new Promise((resolve, reject) => {
      db.get('SELECT name FROM knex_migrations', {}, (err, row) => {
        if (err) {
          reject(err);
        }
        resolve(row);
      });
    });
    const row = await getPromise;
    expect(row.name).to.equal('000_create_rule_table.js');
    db.close();
  });
});
