const log = require('anylogger')('knex:cli');
const { DEFAULT_EXT, DEFAULT_TABLE_NAME } = require('./constants');
const { resolveClientNameWithAliases } = require('../../lib/helpers');
const fs = require('fs');
const path = require('path');
const tildify = require('tildify');
const color = require('colorette');
const argv = require('getopts')(process.argv.slice(2));

function mkConfigObj(opts) {
  if (!opts.client) {
    throw new Error(
      `No configuration file found and no commandline connection parameters passed`
    );
  }

  const envName = opts.env || process.env.NODE_ENV || 'development';
  const resolvedClientName = resolveClientNameWithAliases(opts.client);
  const useNullAsDefault = resolvedClientName === 'sqlite3';
  return {
    ext: DEFAULT_EXT,
    [envName]: {
      useNullAsDefault,
      client: opts.client,
      connection: opts.connection,
      migrations: {
        directory: opts.migrationsDirectory,
        tableName: opts.migrationsTableName || DEFAULT_TABLE_NAME,
      },
    },
  };
}

function resolveEnvironmentConfig(opts, allConfigs, configFilePath) {
  const environment = opts.env || process.env.NODE_ENV || 'development';
  const result = allConfigs[environment] || allConfigs;

  if (allConfigs[environment]) {
    log.log('Using environment:', color.magenta(environment));
  }

  if (!result) {
    log.log(color.red('Warning: unable to read knexfile config'));
    process.exit(1);
  }

  if (argv.debug !== undefined) {
    result.debug = argv.debug;
  }

  // It is safe to assume that unless explicitly specified, we would want
  // migrations, seeds etc. to be generated with same extension
  if (configFilePath) {
    result.ext = result.ext || path.extname(configFilePath).replace('.', '');
  }

  return result;
}

function exit(text) {
  if (text instanceof Error) {
    log.error(
      color.red(`${text.detail ? `${text.detail}\n` : ''}${text.stack}`)
    );
  } else {
    log.error(color.red(text));
  }
  process.exit(1);
}

function success(text) {
  log.log(text);
  process.exit(0);
}

function checkLocalModule(env) {
  if (!env.modulePath) {
    log.log(
      color.red('No local knex install found in:'),
      color.magenta(tildify(env.cwd))
    );
    exit('Try running: npm install knex');
  }
}

function getMigrationExtension(env, opts) {
  const config = resolveEnvironmentConfig(
    opts,
    env.configuration,
    env.configPath
  );

  let ext = DEFAULT_EXT;
  if (argv.x) {
    ext = argv.x;
  } else if (config.migrations && config.migrations.extension) {
    ext = config.migrations.extension;
  } else if (config.ext) {
    ext = config.ext;
  }
  return ext.toLowerCase();
}

function getSeedExtension(env, opts) {
  const config = resolveEnvironmentConfig(
    opts,
    env.configuration,
    env.configPath
  );

  let ext = DEFAULT_EXT;
  if (argv.x) {
    ext = argv.x;
  } else if (config.seeds && config.seeds.extension) {
    ext = config.seeds.extension;
  } else if (config.ext) {
    ext = config.ext;
  }
  return ext.toLowerCase();
}

function getStubPath(configKey, env, opts) {
  const config = resolveEnvironmentConfig(opts, env.configuration);
  const stubDirectory = config[configKey] && config[configKey].directory;

  const { stub } = argv;
  if (!stub) {
    return null;
  } else if (stub.includes('/')) {
    // relative path to stub
    return stub;
  }

  // using stub <name> must have config[configKey].directory defined
  if (!stubDirectory) {
    log.log(color.red('Failed to load stub'), color.magenta(stub));
    exit(`config.${configKey}.directory in knexfile must be defined`);
  }

  return path.join(stubDirectory, stub);
}

module.exports = {
  mkConfigObj,
  resolveEnvironmentConfig,
  exit,
  success,
  checkLocalModule,
  getSeedExtension,
  getMigrationExtension,
  getStubPath,
};
