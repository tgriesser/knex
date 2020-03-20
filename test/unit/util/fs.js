const fs = require('fs');
const os = require('os');
const path = require('path');
const { promisify } = require('util');

const { expect } = require('chai');
const { stat, ensureDirectoryExists } = require('../../../lib/util/fs');

describe('FS functions', () => {
  describe('stat', () => {
    it('should return stats for a given path.', async () => {
      const directoryThatExists = await createTemp();

      const result = await stat(directoryThatExists);

      expect(result).to.be.an.instanceOf(fs.Stats);
    });

    it('should throw an error if the path does not exist.', async () => {
      const directoryThatExists = await createTemp();
      const unexistingPath = path.join(directoryThatExists, 'abc/xyz/123');

      expect(stat(unexistingPath)).to.eventually.be.rejected;
    });
  });

  describe('ensureDirectoryExists', () => {
    it('should resolve successfully if the directory already exists.', async () => {
      const directoryThatExists = await createTemp();

      const result = await ensureDirectoryExists(directoryThatExists);

      expect(result).to.be.an.instanceOf(fs.Stats);
    });

    it('should create a directory (recursively) if it does not exist.', async () => {
      const directoryThatExists = await createTemp();
      const newPath = path.join(directoryThatExists, 'abc/xyz/123');

      expect(fs.existsSync(newPath)).to.equal(false);

      await ensureDirectoryExists(newPath);

      expect(fs.existsSync(newPath)).to.equal(true);
    });
  });
});

/**
 * Creates a temporary directory and returns it path.
 *
 * @returns {Promise<string>}
 */
function createTemp() {
  return promisify(fs.mkdtemp)(`${os.tmpdir()}${path.sep}`);
}
