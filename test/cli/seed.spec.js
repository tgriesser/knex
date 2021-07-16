'use strict';

const path = require('path');
const { execCommand } = require('cli-testlab');

const KNEX = path.normalize(__dirname + '/../../bin/cli.js');

describe('seed:run', () => {
  before(() => {
    process.env.KNEX_PATH = '../knex.js';
  });

  it('prints non verbose logs', () => {
    return execCommand(
      `node ${KNEX} seed:run --knexfile=test/jake-util/seeds-knexfile.js`,
      {
        expectedOutput: 'Ran 2 seed files',
        notExpectedOutput: ['first.js', 'second.js'],
      }
    );
  });

  it('find files not recursively by default', () => {
    return execCommand(
      `node ${KNEX} seed:run --knexfile=test/jake-util/seeds-knexfile-directories.js`,
      {
        expectedOutput: 'Ran 2 seed files',
        notExpectedOutput: ['before-second.js', 'second.js'],
      }
    );
  });

  it('find files recursively if option is set', () => {
    return execCommand(
      `node ${KNEX} seed:run --knexfile=test/jake-util/seeds-knexfile-directories-recursive.js`,
      {
        expectedOutput: 'Ran 3 seed files',
        notExpectedOutput: ['first.js', 'second.js', 'before-second.js'],
      }
    );
  });

  it('find files not recursively by default and print verbose logs', () => {
    return execCommand(
      `node ${KNEX} seed:run --knexfile=test/jake-util/seeds-knexfile-directories.js --verbose`,
      {
        expectedOutput: ['Ran 2 seed files', 'before-second.js', 'second.js'],
      }
    );
  });

  it('find recursively files if option recursive is set and print verbose logs', () => {
    return execCommand(
      `node ${KNEX} seed:run --knexfile=test/jake-util/seeds-knexfile-directories-recursive.js --verbose`,
      {
        expectedOutput: [
          'Ran 3 seed files',
          'first.js',
          'second.js',
          'before-second.js',
        ],
      }
    );
  });

  it('supports async configuration', () => {
    return execCommand(
      `node ${KNEX} seed:run --knexfile=test/jake-util/seeds-knexfile-async.js`,
      {
        expectedOutput: 'Ran 2 seed files',
        notExpectedOutput: ['first.js', 'second.js'],
      }
    );
  });

  it('prints verbose logs', () => {
    return execCommand(
      `node ${KNEX} seed:run --knexfile=test/jake-util/seeds-knexfile.js --verbose`,
      {
        expectedOutput: ['Ran 2 seed files', 'first.js', 'second.js'],
      }
    );
  });

  it('runs specific file', () => {
    return execCommand(
      `node ${KNEX} seed:run --knexfile=test/jake-util/seeds-knexfile.js --specific=second.js`,
      {
        expectedOutput: 'Ran 1 seed files',
        notExpectedOutput: ['first.js', 'second.js'],
      }
    );
  });

  it('handles non existing specific seed file errors correctly', () => {
    return execCommand(
      `node ${KNEX} seed:run --knexfile=test/jake-util/seeds-knexfile.js --specific=intentionally-non-existing-404-seed.js`,
      {
        expectedErrorMessage: ['Invalid argument provided', 'do(es) not exist'],
      }
    );
  });

  it('runs specific file in a recursive folder', () => {
    return execCommand(
      `node ${KNEX} seed:run --knexfile=test/jake-util/seeds-knexfile-directories.js --specific=second.js`,
      {
        expectedOutput: 'Ran 1 seed files',
        notExpectedOutput: ['first.js', 'second.js'],
      }
    );
  });

  it('handles seeding errors correctly', () => {
    return execCommand(
      `node ${KNEX} seed:run --knexfile=test/jake-util/seeds-error-knexfile.js`,
      {
        expectedErrorMessage: ['Error while executing', 'seeds.js', 'Boom'],
      }
    );
  });
});
