const { DEFAULT_EXT, DEFAULT_TABLE_NAME } = require('./constants');
const { resolveClientNameWithAliases } = require('../../lib/helpers');
const fs = require('fs');
const path = require('path');
const tildify = require('tildify');
const color = require('colorette');
const argv = require('getopts')(process.argv.slice(2));

function parseConfigObj(opts) {
  const config = { migrations: {} };

  if (opts.client) {
    config.client = opts.client;
  }

  if (opts.connection) {
    config.connection = opts.connection;
  }

  if (opts.migrationsDirectory) {
    config.migrations.directory = opts.migrationsDirectory;
  }

  if (opts.migrationsTableName) {
    config.migrations.tableName = opts.migrationsTableName;
  }

  return config;
}

function mkConfigObj(opts) {
  if (!opts.client) {
    throw new Error(
      `No configuration file found and no commandline connection parameters passed`
    );
  }

  const envName = opts.env || process.env.NODE_ENV || 'development';
  const resolvedClientName = resolveClientNameWithAliases(opts.client);
  const useNullAsDefault = resolvedClientName === 'sqlite3';
  const parsedConfig = parseConfigObj(opts);

  return {
    ext: DEFAULT_EXT,
    [envName]: {
      ...parsedConfig,
      useNullAsDefault,
      tableName: parsedConfig.tableName || DEFAULT_TABLE_NAME,
    },
  };
}

function resolveEnvironmentConfig(opts, allConfigs, configFilePath) {
  const environment = opts.env || process.env.NODE_ENV || 'development';
  const result = allConfigs[environment] || allConfigs;

  if (allConfigs[environment]) {
    console.log('Using environment:', color.magenta(environment));
  }

  if (!result) {
    console.log(color.red('Warning: unable to read knexfile config'));
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
    console.error(
      color.red(`${text.detail ? `${text.detail}\n` : ''}${text.stack}`)
    );
  } else {
    console.error(color.red(text));
  }
  process.exit(1);
}

function success(text) {
  console.log(text);
  process.exit(0);
}

function checkLocalModule(env) {
  if (!env.modulePath) {
    console.log(
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
    console.log(color.red('Failed to load stub'), color.magenta(stub));
    exit(`config.${configKey}.directory in knexfile must be defined`);
  }

  return path.join(stubDirectory, stub);
}

module.exports = {
  parseConfigObj,
  mkConfigObj,
  resolveEnvironmentConfig,
  exit,
  success,
  checkLocalModule,
  getSeedExtension,
  getMigrationExtension,
  getStubPath,
};
