'use strict';

const fs = require('fs');
const path = require('path');
const { execCommand } = require('cli-testlab');
const { expect } = require('chai');

const KNEX = path.normalize(__dirname + '/../../bin/cli.js');
const {
  migrationStubOptionSetup,
  expectContentMatchesStub,
  setupFileHelper,
} = require('./cli-test-utils');
const { createTemp } = require('../../lib/util/fs');

describe('migrate:make', () => {
  describe('-x option: make migration using a specific extension', () => {
    /**
     * @type FileTestHelper
     */
    let fileHelper;
    beforeEach(() => {
      fileHelper = setupFileHelper();
    });

    afterEach(() => {
      fileHelper.cleanup();
    });

    before(() => {
      process.env.KNEX_PATH = '../knex.js';
    });

    it('Create new migration auto-creating migration directory when it does not exist', async () => {
      const tmpDir = await createTemp();
      const migrationsDirectory = path.join(tmpDir, 'abc/xyz/temp/migrations');
      const knexfileContents = `
        module.exports = {
          client: 'sqlite3',
          connection: {
            filename: __dirname + '/test/jake-util/test.sqlite3',
          },
          migrations: {
            directory: '${migrationsDirectory}',
          },
        };`;

      fileHelper.createFile(
        path.join(process.cwd(), 'knexfile.js'),
        knexfileContents,
        { isPathAbsolute: true }
      );

      await execCommand(
        `node ${KNEX} migrate:make somename --knexpath=../knex.js`,
        {
          expectedOutput: 'Created Migration',
        }
      );

      expect(fs.existsSync(migrationsDirectory)).to.equal(true);
      expect(
        fileHelper.fileGlobExists(`${migrationsDirectory}/*_somename.js`)
      ).to.equal(1);
    });

    it('Create new migration without knexfile passed or existing in default location', () => {
      return execCommand(
        `node ${KNEX} migrate:make somename --knexpath=../knex.js`,
        {
          expectedErrorMessage:
            'Failed to resolve config file, knex cannot determine where to generate migrations',
        }
      );
    });

    it('Create new migration with js knexfile passed', async () => {
      fileHelper.registerGlobForCleanup(
        'test/jake-util/knexfile_migrations/*_somename.js'
      );

      await execCommand(
        `node ${KNEX} migrate:make somename --knexfile=test/jake-util/knexfile/knexfile.js --knexpath=../knex.js`,
        {
          expectedOutput: 'Created Migration',
        }
      );

      const fileCount = fileHelper.fileGlobExists(
        'test/jake-util/knexfile_migrations/*_somename.js'
      );
      expect(fileCount).to.equal(1);
    });

    it('Create new migration with ts knexfile passed', async () => {
      fileHelper.registerGlobForCleanup(
        'test/jake-util/knexfile_migrations/*_somename.ts'
      );
      await execCommand(
        `node ${KNEX} migrate:make somename --knexfile=test/jake-util/knexfile-ts/knexfile.ts --knexpath=../knex.js`,
        {
          expectedOutput: 'Created Migration',
        }
      );

      const fileCount = fileHelper.fileGlobExists(
        'test/jake-util/knexfile_migrations/*_somename.ts'
      );
      expect(fileCount).to.equal(1);
    });

    it('Create new migration with default knexfile', () => {
      fileHelper.registerGlobForCleanup(
        'test/jake-util/knexfile_migrations/*_somename.js'
      );
      fileHelper.createFile(
        process.cwd() + '/knexfile.js',
        `
module.exports = {
  client: 'sqlite3',
  connection: {
    filename: __dirname + '/test/jake-util/test.sqlite3',
  },
  migrations: {
    directory: __dirname + '/test/jake-util/knexfile_migrations',
  },
};
    `,
        { isPathAbsolute: true }
      );
      return execCommand(
        `node ${KNEX} migrate:make somename --knexpath=../knex.js`,
        {
          expectedOutput: 'Created Migration',
        }
      );
    });

    it('Create new migration with default ts knexfile', async () => {
      fileHelper.registerGlobForCleanup(
        'test/jake-util/knexfile_migrations/*_somename1.ts'
      );
      const filePath = path.join(process.cwd(), '/knexfile.ts');
      fileHelper.createFile(
        filePath,
        `
module.exports = {
  client: 'sqlite3',
  connection: {
    filename: __dirname + '/test/jake-util/test.sqlite3',
  },
  migrations: {
    directory: __dirname + '/test/jake-util/knexfile_migrations',
  },
};
    `,
        { isPathAbsolute: true }
      );
      await execCommand(
        `node ${KNEX} migrate:make somename1 --knexpath=../knex.js`,
        {
          expectedOutput: 'Created Migration',
        }
      );

      const fileCount = fileHelper.fileGlobExists(
        'test/jake-util/knexfile_migrations/*_somename1.ts'
      );
      expect(fileCount).to.equal(1);
    });

    it('Create new migration with default ts knexfile when knexfile has per-env configurations', async () => {
      fileHelper.registerGlobForCleanup(
        'test/jake-util/knexfile_migrations/*_somename2.ts'
      );
      const filePath = path.join(process.cwd(), '/knexfile.ts');
      fileHelper.createFile(
        filePath,
        `
module.exports = {
  development: {
    client: 'sqlite3',
    connection: {
      filename: __dirname + '/test/jake-util/test.sqlite3',
    },
    migrations: {
      directory: __dirname + '/test/jake-util/knexfile_migrations',
    }
  }
};
    `,
        { isPathAbsolute: true }
      );
      await execCommand(
        `node ${KNEX} migrate:make somename2 --knexpath=../knex.js`,
        {
          expectedOutput: 'Created Migration',
        }
      );

      const fileCount = fileHelper.fileGlobExists(
        'test/jake-util/knexfile_migrations/*_somename2.ts'
      );
      expect(fileCount).to.equal(1);
    });

    it('Create new migration with ts extension using -x switch', async () => {
      fileHelper.registerGlobForCleanup(
        'test/jake-util/knexfile_migrations/*_somename.ts'
      );
      await execCommand(
        `node ${KNEX} migrate:make somename -x ts --knexfile=test/jake-util/knexfile/knexfile.js --knexpath=../knex.js`,
        {
          expectedOutput: 'Created Migration',
        }
      );

      const fileCount = fileHelper.fileGlobExists(
        'test/jake-util/knexfile_migrations/*_somename.ts'
      );
      expect(fileCount).to.equal(1);
    });

    it('Create new migration with ts extension using "extension" knexfile param', async () => {
      fileHelper.registerGlobForCleanup(
        'test/jake-util/knexfile_migrations/*_somename.ts'
      );
      fileHelper.createFile(
        process.cwd() + '/knexfile.js',
        `
module.exports = {
  client: 'sqlite3',
  connection: {
    filename: __dirname + '/test/jake-util/test.sqlite3',
  },
  migrations: {
    extension: 'ts',
    directory: __dirname + '/test/jake-util/knexfile_migrations',
  },
};
    `,
        { isPathAbsolute: true }
      );
      await execCommand(
        `node ${KNEX} migrate:make somename --knexpath=../knex.js`,
        {
          expectedOutput: 'Created Migration',
        }
      );

      const fileCount = fileHelper.fileGlobExists(
        'test/jake-util/knexfile_migrations/*_somename.ts'
      );
      expect(fileCount).to.equal(1);
    });

    it('Create new migration with ts extension using environment "extension" knexfile param', async () => {
      fileHelper.registerGlobForCleanup(
        'test/jake-util/knexfile_migrations/*_somename.ts'
      );
      fileHelper.createFile(
        process.cwd() + '/knexfile.js',
        `
module.exports = {
development: {
  client: 'sqlite3',
  connection: {
    filename: __dirname + '/test/jake-util/test.sqlite3',
  },
  migrations: {
    extension: 'ts',
    directory: __dirname + '/test/jake-util/knexfile_migrations',
  },
  }
};
    `,
        { isPathAbsolute: true }
      );
      await execCommand(
        `node ${KNEX} migrate:make somename --knexpath=../knex.js`,
        {
          expectedOutput: 'Created Migration',
        }
      );

      const fileCount = fileHelper.fileGlobExists(
        'test/jake-util/knexfile_migrations/*_somename.ts'
      );
      expect(fileCount).to.equal(1);
    });
  });

  describe('--stub option: make migration using specific stub file', () => {
    /**
     * @type FileTestHelper
     */
    let fileHelper;
    beforeEach(() => {
      fileHelper = setupFileHelper();
    });

    afterEach(() => {
      fileHelper.cleanup();
    });

    before(() => {
      process.env.KNEX_PATH = '../knex.js';
    });

    it('Create a new migration using --stub </file/path> relative to the knexfile', async () => {
      const { migrationGlobPath } = migrationStubOptionSetup(fileHelper);

      const stubPath = 'test/jake-util/migration-stubs/table.stub';

      await execCommand(
        `node ${KNEX} migrate:make somename --stub ${stubPath} --knexpath=../knex.js`,
        {
          expectedOutput: 'Created Migration',
        }
      );

      const fileCount = fileHelper.fileGlobExists(
        'test/jake-util/knexfile_migrations/*_somename.js'
      );
      expect(fileCount).to.equal(1);
      expectContentMatchesStub(stubPath, migrationGlobPath, fileHelper);
    });

    it('Create a new migration with stub parameter in knexfile', async () => {
      const migrationGlobPath = 'test/jake-util/knexfile-stubs/*_somename.js';
      fileHelper.registerGlobForCleanup(migrationGlobPath);

      await execCommand(
        `node ${KNEX} migrate:make somename --knexfile=test/jake-util/knexfile-stubs/knexfile.js --knexpath=../knex.js`,
        {
          expectedOutput: 'Created Migration',
        }
      );

      const fileCount = fileHelper.fileGlobExists(
        'test/jake-util/knexfile-stubs/*_somename.js'
      );

      const stubName = 'table.stub';
      const stubPath = `test/jake-util/knexfile-stubs/${stubName}`;
      expect(fileCount).to.equal(1);
      expectContentMatchesStub(stubPath, migrationGlobPath, fileHelper);
    });

    it('Create a new migration with --stub <name> in config.migrations.directory', async () => {
      const { migrationGlobPath } = migrationStubOptionSetup(fileHelper);

      const stubName = 'table-foreign.stub';
      const stubPath = `test/jake-util/knexfile_migrations/${stubName}`;

      await execCommand(
        `node ${KNEX} migrate:make somename --stub ${stubName} --knexpath=../knex.js`,
        {
          expectedOutput: 'Created Migration',
        }
      );

      const fileCount = fileHelper.fileGlobExists(
        'test/jake-util/knexfile_migrations/*_somename.js'
      );
      expect(fileCount).to.equal(1);
      expectContentMatchesStub(stubPath, migrationGlobPath, fileHelper);
    });

    it('Create a new migration with --stub <name> when file does not exist', async () => {
      migrationStubOptionSetup(fileHelper);
      const stubName = 'non-existat.stub';
      await execCommand(
        `node ${KNEX} migrate:make somename --stub ${stubName} --knexpath=../knex.js`,
        {
          expectedErrorMessage: 'ENOENT:',
        }
      );
    });

    it('Create a new migration with --stub </file/path> when file does not exist', async () => {
      migrationStubOptionSetup(fileHelper);
      const stubPath = '/path/non-existat.stub';
      await execCommand(
        `node ${KNEX} migrate:make somename --stub ${stubPath} --knexpath=../knex.js`,
        {
          expectedErrorMessage: 'ENOENT:',
        }
      );
    });

    it('Create a new migration with --stub <name> when config.migrations.directory not defined', async () => {
      fileHelper.createFile(
        process.cwd() + '/knexfile.js',
        `
  module.exports = {
    development: {
      client: 'sqlite3',
      connection: {
        filename: __dirname + '/test/jake-util/test.sqlite3',
      },
      migrations: {
        // directory not defined
      },
    }
  };
      `,
        { isPathAbsolute: true }
      );

      const stubName = 'table-foreign.stub';
      await execCommand(
        `node ${KNEX} migrate:make somename --stub ${stubName} --knexpath=../knex.js`,
        {
          expectedErrorMessage:
            'config.migrations.directory in knexfile must be defined',
        }
      );
    });
  });
});
