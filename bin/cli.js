#!/usr/bin/env node
const rechoir = require('rechoir');
const interpret = require('interpret');
const resolveFrom = require('resolve-from');
const path = require('path');
const tildify = require('tildify');
const commander = require('commander');
const color = require('colorette');
const argv = require('getopts')(process.argv.slice(2));
const cliPkg = require('../package');
const {
  mkConfigObj,
  resolveEnvironmentConfig,
  exit,
  success,
  checkLocalModule,
  getMigrationExtension,
  getSeedExtension,
  getStubPath,
  findUpModulePath,
  findUpConfig,
} = require('./utils/cli-config-utils');
const {
  existsSync,
  readFile,
  writeFile,
} = require('../lib/migrations/util/fs');

const { listMigrations } = require('./utils/migrationsLister');

async function openKnexfile(configPath) {
  const importFile = require('../lib/migrations/util/import-file'); // require me late!
  let config = await importFile(configPath);
  if (config && config.default) {
    config = config.default;
  }
  if (typeof config === 'function') {
    config = await config();
  }
  return config;
}

async function initKnex(env, opts) {
  checkLocalModule(env);
  if (process.cwd() !== env.cwd) {
    process.chdir(env.cwd);
    console.log(
      'Working directory changed to',
      color.magenta(tildify(env.cwd))
    );
  }

  env.configuration = env.configPath
    ? await openKnexfile(env.configPath)
    : mkConfigObj(opts);

  const resolvedConfig = resolveEnvironmentConfig(opts, env.configuration);

  // override connection, client and migrationsTableName
  // if specified through cmd line arguments

  resolvedConfig.connection = opts.connection || resolvedConfig.connection
  resolvedConfig.client = opts.client || resolvedConfig.client
  resolvedConfig.migrations.tableName = opts.migrationsTableName || resolvedConfig.migrations.tableName

  const knex = require(env.modulePath);
  return knex(resolvedConfig);
}

function invoke() {
  const filetypes = ['js', 'coffee', 'ts', 'eg', 'ls'];

  const cwd = argv.knexfile
    ? path.dirname(path.resolve(argv.knexfile))
    : process.cwd();

  // TODO add knexpath here eventually
  const modulePath =
    resolveFrom.silent(cwd, 'knex') ||
    findUpModulePath(cwd, 'knex') ||
    process.env.KNEX_PATH;

  const configPath =
    argv.knexfile && existsSync(argv.knexfile)
      ? path.resolve(argv.knexfile)
      : findUpConfig(cwd, 'knexfile', filetypes);

  if (configPath) {
    const autoloads = rechoir.prepare(
      interpret.jsVariants,
      configPath,
      cwd,
      true
    );
    if (autoloads instanceof Error) {
      // Only errors
      autoloads.failures.forEach(function (failed) {
        console.log(
          color.red('Failed to load external module'),
          color.magenta(failed.moduleName)
        );
      });
    } else if (Array.isArray(autoloads)) {
      const succeeded = autoloads[autoloads.length - 1];
      console.log(
        'Requiring external module',
        color.magenta(succeeded.moduleName)
      );
    }
  }

  const env = {
    cwd,
    modulePath,
    configPath,
    configuration: null,
  };

  // rechoir.prepare(interpret.jsVariants, configPath, cwd);

  let modulePackage = {};
  try {
    modulePackage = require(path.join(
      path.dirname(env.modulePath),
      'package.json'
    ));
  } catch (e) {}

  const cliVersion = [
    color.blue('Knex CLI version:'),
    color.green(cliPkg.version),
  ].join(' ');

  const localVersion = [
    color.blue('Knex Local version:'),
    color.green(modulePackage.version || 'None'),
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
    )
    .option('--esm', 'Enable ESM interop.')
    .option('--specific [path]', 'Specify one seed file to execute.')
    .option(
      '--timestamp-filename-prefix',
      'Enable a timestamp prefix on name of generated seed files.'
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
      readFile(
        path.dirname(env.modulePath) +
          '/lib/migrations/migrate/stub/knexfile-' +
          type +
          '.stub'
      )
        .then((code) => {
          return writeFile(stubPath, code);
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
    .action(async (name) => {
      const opts = commander.opts();
      opts.client = opts.client || 'sqlite3'; // We don't really care about client when creating migrations
      const instance = await initKnex(env, opts);
      const ext = getMigrationExtension(env, opts);
      const configOverrides = { extension: ext };

      const stub = getStubPath('migrations', env, opts);
      if (stub) {
        configOverrides.stub = stub;
      }

      instance.migrate
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
    .action(async () => {
      try {
        const instance = await initKnex(env, commander.opts());
        const [batchNo, log] = await instance.migrate.latest();
        if (log.length === 0) {
          success(color.cyan('Already up to date'));
        }
        success(
          color.green(`Batch ${batchNo} run: ${log.length} migrations`) +
            (argv.verbose ? `\n${color.cyan(log.join('\n'))}` : '')
        );
      } catch (err) {
        exit(err);
      }
    });

  commander
    .command('migrate:up [<name>]')
    .description(
      '        Run the next or the specified migration that has not yet been run.'
    )
    .action((name) => {
      initKnex(env, commander.opts())
        .then((instance) => instance.migrate.up({ name }))
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

      initKnex(env, commander.opts())
        .then((instance) => instance.migrate.rollback(null, all))
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
    .command('migrate:down [<name>]')
    .description(
      '        Undo the last or the specified migration that was already run.'
    )
    .action((name) => {
      initKnex(env, commander.opts())
        .then((instance) => instance.migrate.down({ name }))
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
      initKnex(env, commander.opts())
        .then((instance) => instance.migrate.currentVersion())
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
      initKnex(env, commander.opts())
        .then((instance) => {
          return instance.migrate.list();
        })
        .then(([completed, newMigrations]) => {
          listMigrations(completed, newMigrations);
        })
        .catch(exit);
    });

  commander
    .command('migrate:unlock')
    .description('        Forcibly unlocks the migrations lock table.')
    .action(() => {
      initKnex(env, commander.opts())
        .then((instance) => instance.migrate.forceFreeMigrationsLock())
        .then(() => {
          success(
            color.green(`Succesfully unlocked the migrations lock table`)
          );
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
    .option(
      `--stub [<relative/path/from/knexfile>|<name>]`,
      'Specify the seed stub to use. If using <name> the file must be located in config.seeds.directory'
    )
    .option(
      '--timestamp-filename-prefix',
      'Enable a timestamp prefix on name of generated seed files.',
      false
    )
    .action(async (name) => {
      const opts = commander.opts();
      opts.client = opts.client || 'sqlite3'; // We don't really care about client when creating seeds
      const instance = await initKnex(env, opts);
      const ext = getSeedExtension(env, opts);
      const configOverrides = { extension: ext };
      const stub = getStubPath('seeds', env, opts);
      if (stub) {
        configOverrides.stub = stub;
      }

      if (opts.timestampFilenamePrefix) {
        configOverrides.timestampFilenamePrefix = opts.timestampFilenamePrefix;
      }

      instance.seed
        .make(name, configOverrides)
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
      initKnex(env, commander.opts())
        .then((instance) => instance.seed.run({ specific: argv.specific }))
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
}

// FYI: The handling for the `--cwd` and `--knexfile` arguments is a bit strange,
//      but we decided to retain the behavior for backwards-compatibility.  In
//      particular: if `--knexfile` is a relative path, then it will be resolved
//      relative to `--cwd` instead of the shell's CWD.
//
//      So, the easiest way to replicate this behavior is to have the CLI change
//      its CWD to `--cwd` immediately before initializing everything else.  This
//      ensures that path.resolve will then resolve the path to `--knexfile` correctly.
if (argv.cwd) {
  process.chdir(argv.cwd);
}
// Initialize 'esm' before cli.launch
if (argv.esm) {
  // enable esm interop via 'esm' module
  // eslint-disable-next-line no-global-assign
  require = require('esm')(module);
  // https://github.com/standard-things/esm/issues/868
  const ext = require.extensions['.js'];
  require.extensions['.js'] = (m, fileName) => {
    try {
      // default to the original extension
      // this fails if target file parent is of type='module'
      return ext(m, fileName);
    } catch (err) {
      if (err && err.code === 'ERR_REQUIRE_ESM') {
        return m._compile(
          require('fs').readFileSync(fileName, 'utf8'),
          fileName
        );
      }
      throw err;
    }
  };
}

invoke();
