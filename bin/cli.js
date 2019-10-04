#!/usr/bin/env node
/* eslint no-console:0, no-var:0 */
const Liftoff = require('liftoff');
const Bluebird = require('bluebird');
const interpret = require('interpret');
const path = require('path');
const tildify = require('tildify');
const commander = require('commander');
const color = require('colorette');
const argv = require('getopts')(process.argv.slice(2));
const fs = Bluebird.promisifyAll(require('fs'));
const cliPkg = require('../package');
const {
  mkConfigObj,
  resolveKnexFilePath,
  resolveEnvironmentConfig,
  exit,
  success,
  checkLocalModule,
  getMigrationExtension,
  getStubPath,
} = require('./utils/cli-config-utils');
const { DEFAULT_EXT } = require('./utils/constants');
const { listMigrations } = require('./utils/migrationsLister');

function initKnex(env, opts) {
  checkLocalModule(env);
  if (process.cwd() !== env.cwd) {
    process.chdir(env.cwd);
    console.log(
      'Working directory changed to',
      color.magenta(tildify(env.cwd))
    );
  }

  if (!opts.knexfile) {
    const configurationPath = resolveKnexFilePath();
    const configuration = configurationPath
      ? require(configurationPath.path)
      : undefined;

    env.configuration = configuration || mkConfigObj(opts);
    if (!env.configuration.ext && configurationPath) {
      env.configuration.ext = configurationPath.extension;
    }
  }
  // If knexfile is specified
  else {
    const resolvedKnexfilePath = path.resolve(opts.knexfile);
    const knexfileDir = path.dirname(resolvedKnexfilePath);
    process.chdir(knexfileDir);
    env.configuration = require(resolvedKnexfilePath);

    if (!env.configuration) {
      exit(
        'Knexfile not found. Specify a path with --knexfile or pass --client and --connection params in commandline'
      );
    }

    if (!env.configuration.ext) {
      env.configuration.ext = path
        .extname(resolvedKnexfilePath)
        .replace('.', '');
    }
  }

  const resolvedConfig = resolveEnvironmentConfig(opts, env.configuration);

  // override connection, client and migrationsTableName
  // if specified through cmd line arguments

  if (opts.connection) resolvedConfig.connection = opts.connection;
  if (opts.client) resolvedConfig.client = opts.client;
  if (opts.migrationsTableName) {
    resolvedConfig.migrations.tableName = opts.migrationsTableName;
  }

  const knex = require(env.modulePath);
  return knex(resolvedConfig);
}

function invoke(env) {
  env.modulePath = env.modulePath || env.knexpath || process.env.KNEX_PATH;

  const filetypes = ['js', 'coffee', 'ts', 'eg', 'ls'];
  let pending = null;

  const cliVersion = [
    color.blue('Knex CLI version:'),
    color.green(cliPkg.version),
  ].join(' ');

  const localVersion = [
    color.blue('Knex Local version:'),
    color.green(env.modulePackage.version || 'None'),
  ].join(' ');

  commander
    .version(`${cliVersion}\n${localVersion}`)
    .option('--debug', 'Run with debugging.')
    .option('--knexfile [path]', 'Specify the knexfile path.')
    .option('--knexpath [path]', 'Specify the path to knex instance.')
    .option('--cwd [path]', 'Specify the working directory.')
    .option('--client [name]', 'Set DB client without a knexfile.')
    .option('--connection [address]', 'Set DB connection without a knexfile.')
    .option(
      '--migrations-directory [path]',
      'Set migrations directory without a knexfile.'
    )
    .option(
      '--migrations-table-name [path]',
      'Set migrations table name without a knexfile.'
    )
    .option(
      '--env [name]',
      'environment, default: process.env.NODE_ENV || development'
    );

  commander
    .command('init')
    .description('        Create a fresh knexfile.')
    .option(
      `-x [${filetypes.join('|')}]`,
      'Specify the knexfile extension (default js)'
    )
    .action(() => {
      const type = (argv.x || 'js').toLowerCase();
      if (filetypes.indexOf(type) === -1) {
        exit(`Invalid filetype specified: ${type}`);
      }
      if (env.configuration) {
        exit(`Error: ${env.knexfile} already exists`);
      }
      checkLocalModule(env);
      const stubPath = `./knexfile.${type}`;
      pending = fs
        .readFileAsync(
          path.dirname(env.modulePath) +
            '/lib/migrate/stub/knexfile-' +
            type +
            '.stub'
        )
        .then((code) => {
          return fs.writeFileAsync(stubPath, code);
        })
        .then(() => {
          success(color.green(`Created ${stubPath}`));
        })
        .catch(exit);
    });

  commander
    .command('migrate:make <name>')
    .description('        Create a named migration file.')
    .option(
      `-x [${filetypes.join('|')}]`,
      'Specify the stub extension (default js)'
    )
    .option(
      `--stub [<relative/path/from/knexfile>|<name>]`,
      'Specify the migration stub to use. If using <name> the file must be located in config.migrations.directory'
    )
    .action((name) => {
      const opts = commander.opts();
      opts.client = opts.client || 'sqlite3'; // We don't really care about client when creating migrations
      const instance = initKnex(env, opts);
      const ext = getMigrationExtension(env, opts);
      const configOverrides = { extension: ext };

      const stub = getStubPath(env, opts);
      if (stub) {
        configOverrides.stub = stub;
      }

      pending = instance.migrate
        .make(name, configOverrides)
        .then((name) => {
          success(color.green(`Created Migration: ${name}`));
        })
        .catch(exit);
    });

  commander
    .command('migrate:latest')
    .description('        Run all migrations that have not yet been run.')
    .option('--verbose', 'verbose')
    .action(() => {
      pending = initKnex(env, commander.opts())
        .migrate.latest()
        .then(([batchNo, log]) => {
          if (log.length === 0) {
            success(color.cyan('Already up to date'));
          }
          success(
            color.green(`Batch ${batchNo} run: ${log.length} migrations`) +
              (argv.verbose ? `\n${color.cyan(log.join('\n'))}` : '')
          );
        })
        .catch(exit);
    });

  commander
    .command('migrate:up')
    .description('        Run the next migration that has not yet been run.')
    .action(() => {
      pending = initKnex(env, commander.opts())
        .migrate.up()
        .then(([batchNo, log]) => {
          if (log.length === 0) {
            success(color.cyan('Already up to date'));
          }

          success(
            color.green(
              `Batch ${batchNo} ran the following migrations:\n${log.join(
                '\n'
              )}`
            )
          );
        })
        .catch(exit);
    });

  commander
    .command('migrate:rollback')
    .description('        Rollback the last batch of migrations performed.')
    .option('--all', 'rollback all completed migrations')
    .option('--verbose', 'verbose')
    .action((cmd) => {
      const { all } = cmd;

      pending = initKnex(env, commander.opts())
        .migrate.rollback(null, all)
        .then(([batchNo, log]) => {
          if (log.length === 0) {
            success(color.cyan('Already at the base migration'));
          }
          success(
            color.green(
              `Batch ${batchNo} rolled back: ${log.length} migrations`
            ) + (argv.verbose ? `\n${color.cyan(log.join('\n'))}` : '')
          );
        })
        .catch(exit);
    });

  commander
    .command('migrate:down')
    .description('        Undo the last migration performed.')
    .action(() => {
      pending = initKnex(env, commander.opts())
        .migrate.down()
        .then(([batchNo, log]) => {
          if (log.length === 0) {
            success(color.cyan('Already at the base migration'));
          }

          success(
            color.green(
              `Batch ${batchNo} rolled back the following migrations:\n${log.join(
                '\n'
              )}`
            )
          );
        })
        .catch(exit);
    });

  commander
    .command('migrate:currentVersion')
    .description('        View the current version for the migration.')
    .action(() => {
      pending = initKnex(env, commander.opts())
        .migrate.currentVersion()
        .then((version) => {
          success(color.green('Current Version: ') + color.blue(version));
        })
        .catch(exit);
    });

  commander
    .command('migrate:list')
    .alias('migrate:status')
    .description('        List all migrations files with status.')
    .action(() => {
      pending = initKnex(env, commander.opts())
        .migrate.list()
        .then(([completed, newMigrations]) => {
          listMigrations(completed, newMigrations);
        })
        .catch(exit);
    });

  commander
    .command('seed:make <name>')
    .description('        Create a named seed file.')
    .option(
      `-x [${filetypes.join('|')}]`,
      'Specify the stub extension (default js)'
    )
    .action((name) => {
      const opts = commander.opts();
      opts.client = opts.client || 'sqlite3'; // We don't really care about client when creating seeds
      const instance = initKnex(env, opts);
      const ext = (
        argv.x ||
        env.configuration.ext ||
        DEFAULT_EXT
      ).toLowerCase();
      pending = instance.seed
        .make(name, { extension: ext })
        .then((name) => {
          success(color.green(`Created seed file: ${name}`));
        })
        .catch(exit);
    });

  commander
    .command('seed:run')
    .description('        Run seed files.')
    .option('--verbose', 'verbose')
    .option('--specific', 'run specific seed file')
    .action(() => {
      pending = initKnex(env, commander.opts())
        .seed.run({ specific: argv.specific })
        .then(([log]) => {
          if (log.length === 0) {
            success(color.cyan('No seed files exist'));
          }
          success(
            color.green(`Ran ${log.length} seed files`) +
              (argv.verbose ? `\n${color.cyan(log.join('\n'))}` : '')
          );
        })
        .catch(exit);
    });

  commander.parse(process.argv);

  Bluebird.resolve(pending).then(() => {
    commander.outputHelp();
    exit('Unknown command-line options, exiting');
  });
}

const cli = new Liftoff({
  name: 'knex',
  extensions: interpret.jsVariants,
  v8flags: require('v8flags'),
});

cli.on('require', function(name) {
  console.log('Requiring external module', color.magenta(name));
});

cli.on('requireFail', function(name) {
  console.log(color.red('Failed to load external module'), color.magenta(name));
});

cli.launch(
  {
    cwd: argv.cwd,
    knexfile: argv.knexfile,
    knexpath: argv.knexpath,
    require: argv.require,
    completion: argv.completion,
  },
  invoke
);
