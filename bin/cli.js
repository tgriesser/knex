#!/usr/bin/env node
/* eslint no-console:0, no-var:0 */
const Liftoff = require('liftoff');
const interpret = require('interpret');
const path = require('path');
const pkgDir = require('pkg-dir');
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
} = require('./utils/cli-config-utils');
const { readFile, writeFile } = require('./../lib/util/fs');

const { listMigrations } = require('./utils/migrationsLister');

async function openKnexfile(configPath) {
  const importFile = require('../lib/util/import-file'); // require me late!
  let config = await importFile(configPath);
  if (config && config.default) {
    config = config.default;
  }
  if (typeof config === 'function') {
    config = await config();
  }
  return config;
}

const initKnex = async (env, opts) => {
  if (opts.esm) {
    console.warn(
      `The 'esm' opt is deprecated. Knex supports esm module imports using 'import()'`
    );
  }
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

  const resolvedConfig = resolveEnvironmentConfig(
    opts,
    env.configuration,
    env.configPath
  );
  console.log(env.modulePath);
  const knex = require(env.modulePath);
  return knex(resolvedConfig);
};

function invoke(env) {
  env.modulePath = env.modulePath || env.knexpath || process.env.KNEX_PATH;

  const filetypes = ['js', 'coffee', 'ts', 'eg', 'ls', 'cjs', 'mjs'];

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
    )
    .option('--esm', 'Enable ESM interop. (Deprecated)')
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
    .action(async () => {
      try {
        const packageDirectory = await pkgDir(process.cwd());
        const consumingPackageJson = require(path.resolve(
          packageDirectory,
          'package.json'
        ));
        const consumingPackageIsModule = consumingPackageJson.type === 'module';
        const stubExtension = (argv.x || 'js').toLowerCase();
        const stubFormatToUse =
          stubExtension === 'js'
            ? consumingPackageIsModule
              ? 'mjs'
              : 'cjs'
            : stubExtension;

        if (filetypes.indexOf(stubExtension) === -1) {
          exit(`Invalid filetype specified: ${stubExtension}`);
        }
        if (env.configuration) {
          exit(`Error: ${env.knexfile} already exists`);
        }
        checkLocalModule(env);
        const stubPath = `./knexfile.${stubExtension}`;
        const code = await fsPromised.readFile(
          `${path.dirname(
            env.modulePath
          )}/lib/migrate/stub/knexfile-${stubFormatToUse}.stub`
        );
        await fsPromised.writeFile(stubPath, code);
        success(color.green(`Created ${stubPath}`));
      } catch (error) {
        console.log(error);
        exit();
      }
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
      try {
        const opts = commander.opts();
        opts.client = opts.client || 'sqlite3'; // We don't really care about client when creating migrations
        const knex = await initKnex(env, opts);
        const ext = getMigrationExtension(env, opts);
        const configOverrides = { extension: ext };
        const stub = getStubPath('migrations', env, opts);
        if (stub) {
          configOverrides.stub = stub;
        }

        const createdName = await knex.migrate.make(name, configOverrides);
        success(color.green(`Created Migration: ${createdName}`));
      } catch (error) {
        console.log(error);
        throw error;
        exit();
      }
    });

  commander
    .command('migrate:latest')
    .description('        Run all migrations that have not yet been run.')
    .option('--verbose', 'verbose')
    .action(async () => {
      try {
        const knex = await initKnex(env, commander.opts());
        const [batchNo, log] = await knex.migrate.latest();
        if (log.length === 0) {
          success(color.cyan('Already up to date'));
        }
        success(
          color.green(`Batch ${batchNo} run: ${log.length} migrations`) +
            (argv.verbose ? `\n${color.cyan(log.join('\n'))}` : '')
        );
      } catch (error) {
        console.log(error);
        exit();
      }
    });

  commander
    .command('migrate:up [<name>]')
    .description(
      '        Run the next or the specified migration that has not yet been run.'
    )
    .action(async (name) => {
      try {
        const knex = await initKnex(env, commander.opts());
        const [batchNo, log] = await knex.migrate.up({ name });
        if (log.length === 0) {
          success(color.cyan('Already up to date'));
        }
        const migrationsRun = log.join('\n');
        success(
          color.green(
            `Batch ${batchNo} ran the following migrations:\n${migrationsRun}`
          )
        );
      } catch (error) {
        console.log(error);
        exit();
      }
    });

  commander
    .command('migrate:rollback')
    .description('        Rollback the last batch of migrations performed.')
    .option('--all', 'rollback all completed migrations')
    .option('--verbose', 'verbose')
    .action(async (cmd) => {
      try {
        const { all } = cmd;
        const knex = await initKnex(env, commander.opts());
        const [batchNo, log] = await knex.migrate.rollback(null, all);
        if (log.length === 0) {
          success(color.cyan('Already at the base migration'));
        }
        success(
          color.green(
            `Batch ${batchNo} rolled back: ${log.length} migrations`
          ) + (argv.verbose ? `\n${color.cyan(log.join('\n'))}` : '')
        );
      } catch (error) {
        console.log(error);
        exit();
      }
    });

  commander
    .command('migrate:down [<name>]')
    .description(
      '        Undo the last or the specified migration that was already run.'
    )
    .action(async (name) => {
      try {
        const knex = await initKnex(env, commander.opts());
        const [batchNo, log] = await knex.migrate.down({ name });
        if (log.length === 0) {
          success(color.cyan('Already at the base migration'));
        }
        const rolledBack = log.join('/n');
        success(
          color.green(
            `Batch ${batchNo} rolled back the following migrations:\n${rolledBack}`
          )
        );
      } catch (error) {
        console.log(error);
        exit();
      }
    });

  commander
    .command('migrate:currentVersion')
    .description('        View the current version for the migration.')
    .action(async () => {
      try {
        const knex = await initKnex(env, commander.opts());
        const version = await knex.migrate.currentVersion();
        success(color.green('Current Version: ') + color.blue(version));
      } catch (error) {
        console.log(error);
        exit();
      }
    });

  commander
    .command('migrate:list')
    .alias('migrate:status')
    .description('        List all migrations files with status.')
    .action(async () => {
      try {
        const knex = await initKnex(env, commander.opts());
        const [completed, newMigrations] = await knex.migrate.list();
        listMigrations(completed, newMigrations);
      } catch (error) {
        console.log(error);
        exit();
      }
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
      try {
        const opts = commander.opts();
        opts.client = opts.client || 'sqlite3'; // We don't really care about client when creating seeds
        const knex = await initKnex(env, opts);
        const ext = getSeedExtension(env, opts);
        const configOverrides = { extension: ext };
        const stub = getStubPath('seeds', env, opts);
        if (stub) {
          configOverrides.stub = stub;
        }
        if (opts.timestampFilenamePrefix) {
          configOverrides.timestampFilenamePrefix =
            opts.timestampFilenamePrefix;
        }
        const createdName = await knex.seed.make(name, configOverrides);
        success(color.green(`Created seed file: ${createdName}`));
      } catch (error) {
        console.log(error);
        exit();
      }
    });

  commander
    .command('seed:run')
    .description('        Run seed files.')
    .option('--verbose', 'verbose')
    .option('--specific', 'run specific seed file')
    .action(async () => {
      try {
        const knex = await initKnex(env, commander.opts());
        const [log] = await knex.seed.run({ specific: argv.specific });
        if (log.length === 0) {
          success(color.cyan('No seed files exist'));
        }
        success(
          color.green(`Ran ${log.length} seed files`) +
            (argv.verbose ? `\n${color.cyan(log.join('\n'))}` : '')
        );
      } catch (error) {
        console.log(error);
        exit(error);
      }
    });

  if (!process.argv.slice(2).length) {
    commander.outputHelp();
  }

  commander.parse(process.argv);
}

const cli = new Liftoff({
  name: 'knex',
  extensions: interpret.jsVariants,
  v8flags: require('v8flags'),
  moduleName: require('../package.json').name,
});

cli.on('require', function (name) {
  console.log('Requiring external module', color.magenta(name));
});

cli.on('requireFail', function (name) {
  console.log(color.red('Failed to load external module'), color.magenta(name));
});

// FYI: The handling for the `--cwd` and `--knexfile` arguments is a bit strange,
//      but we decided to retain the behavior for backwards-compatibility.  In
//      particular: if `--knexfile` is a relative path, then it will be resolved
//      relative to `--cwd` instead of the shell's CWD.
//
//      So, the easiest way to replicate this behavior is to have the CLI change
//      its CWD to `--cwd` immediately before initializing everything else.  This
//      ensures that Liftoff will then resolve the path to `--knexfile` correctly.
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

cli.launch(
  {
    configPath: argv.knexfile,
    require: argv.require,
    completion: argv.completion,
  },
  invoke
);
