// Seeder
// -------

const path = require('path');
const flatten = require('lodash/flatten');
const extend = require('lodash/extend');
const includes = require('lodash/includes');
const { ensureDirectoryExists, getFilepathsInFolder } = require('../util/fs');
const { writeJsFileUsingTemplate } = require('../util/template');
const { yyyymmddhhmmss } = require('../util/timestamp');

const filterByLoadExtensions = (extensions) => (value) => {
  const extension = path.extname(value);
  return includes(extensions, extension);
};

// The new seeds we're performing, typically called from the `knex.seed`
// interface on the main `knex` object. Passes the `knex` instance performing
// the seeds.
class Seeder {
  constructor(knex) {
    this.knex = knex;
    this.config = this.setConfig(knex.client.config.seeds);
  }

  // Runs seed files for the given environment.
  async run(config) {
    this.config = this.setConfig(config);
    let files = await this._listAll();
    if (config && config.specific) {
      const seeds = [].concat(config.specific);
      const map = files.reduce(
        (result, file) => ((result[path.basename(file)] = file), result),
        {}
      );
      // Ensure that seed files are executed in the same order
      // as specified in the command line, removing any invalid seeds
      files = seeds.map((seed) => map[seed]).filter((seed) => seed);
      if (files.length !== seeds.length) {
        const invalidSeeds = seeds.filter((seed) => !map[seed]);
        throw new Error(
          `Invalid argument provided: the specific seed(s) "${invalidSeeds.join()}" do(es) not exist.`
        );
      }
    }
    return this._runSeeds(files);
  }

  // Creates a new seed file, with a given name.
  async make(name, config) {
    this.config = this.setConfig(config);
    if (!name)
      throw new Error('A name must be specified for the generated seed');
    await this._ensureFolder(config);
    const seedPath = await this._writeNewSeed(name);
    return seedPath;
  }

  // Lists all available seed files as a sorted array.
  async _listAll(config) {
    this.config = this.setConfig(config);
    const { loadExtensions, recursive } = this.config;
    const seeds = flatten(
      await Promise.all(
        this._absoluteConfigDirs().map((d) =>
          getFilepathsInFolder(d, recursive)
        )
      )
    );
    // if true, each dir are already sorted
    // (getFilepathsInFolderRecursively does this)
    // if false, we need to sort all the seeds
    if (this.config.sortDirsSeparately) {
      return seeds.filter(filterByLoadExtensions(loadExtensions));
    } else {
      return seeds.filter(filterByLoadExtensions(loadExtensions)).sort();
    }
  }

  // Ensures a folder for the seeds exist, dependent on the
  // seed config settings.
  _ensureFolder() {
    const dirs = this._absoluteConfigDirs();
    const promises = dirs.map(ensureDirectoryExists);
    return Promise.all(promises);
  }

  // Run seed files, in sequence.
  _runSeeds(seeds) {
    seeds.forEach((seed) => this._validateSeedStructure(seed));
    return this._waterfallBatch(seeds);
  }

  // Validates seed files by requiring and checking for a `seed` function.
  async _validateSeedStructure(filepath) {
    const importFile = require('../util/import-file'); // late import
    const seed = await importFile(filepath);
    if (typeof seed.seed !== 'function') {
      throw new Error(
        `Invalid seed file: ${filepath} must have a seed function`
      );
    }
    return filepath;
  }

  _getStubPath() {
    return (
      this.config.stub ||
      path.join(__dirname, 'stub', this.config.extension + '.stub')
    );
  }

  _getNewStubFileName(name) {
    if (name[0] === '-') name = name.slice(1);

    if (this.config.timestampFilenamePrefix === true) {
      name = `${yyyymmddhhmmss()}_${name}`;
    }

    return `${name}.${this.config.extension}`;
  }

  _getNewStubFilePath(name) {
    const fileName = this._getNewStubFileName(name);
    const dirs = this._absoluteConfigDirs();
    const dir = dirs.slice(-1)[0]; // Get last specified directory
    return path.join(dir, fileName);
  }

  // Write a new seed to disk, using the config and generated filename,
  // passing any `variables` given in the config to the template.
  async _writeNewSeed(name) {
    const seedPath = this._getNewStubFilePath(name);
    await writeJsFileUsingTemplate(
      seedPath,
      this._getStubPath(),
      { variable: 'd' },
      this.config.variables || {}
    );
    return seedPath;
  }

  // Runs a batch of seed files.
  async _waterfallBatch(seeds) {
    const { knex } = this;
    const log = [];
    for (const seedPath of seeds) {
      const importFile = require('../util/import-file'); // late import
      const seed = await importFile(seedPath);
      try {
        await seed.seed(knex);
        log.push(seedPath);
      } catch (originalError) {
        const error = new Error(
          `Error while executing "${seedPath}" seed: ${originalError.message}`
        );
        error.original = originalError;
        error.stack =
          error.stack.split('\n').slice(0, 2).join('\n') +
          '\n' +
          originalError.stack;
        throw error;
      }
    }
    return [log];
  }

  /**
   * Return all the config directories
   * @returns {string[]}
   */
  _absoluteConfigDirs() {
    const directories = Array.isArray(this.config.directory)
      ? this.config.directory
      : [this.config.directory];
    return directories.map((directory) => {
      if (!directory) {
        console.warn(
          'Failed to resolve config file, knex cannot determine where to run or make seeds'
        );
      }
      return path.resolve(process.cwd(), directory);
    });
  }

  setConfig(config) {
    return extend(
      {
        extension: 'js',
        directory: './seeds',
        loadExtensions: [
          '.co',
          '.coffee',
          '.eg',
          '.iced',
          '.js',
          '.litcoffee',
          '.ls',
          '.ts',
          '.cjs',
        ],
        timestampFilenamePrefix: false,
        sortDirsSeparately: false,
        recursive: false,
      },
      this.config || {},
      config
    );
  }
}

module.exports = Seeder;
