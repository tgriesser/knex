'use strict';

const { expect } = require('chai');

const path = require('path');
const rimraf = require('rimraf');

module.exports = function (knex) {
  describe('knex.seed.make', () => {
    it('should create a new seed file with the make method', async () => {
      const name = await knex.seed.make('test');

      rimraf.sync(path.dirname(name));
      expect(path.basename(name)).to.equal('test.js');
    });
  });

  describe('knex.seed.run', () => {
    it('should run all seed files in the configured seed directory', async () => {
      const [data] = await knex.seed.run({
        directory: 'test/integration/seed/test',
      });

      expect(path.basename(data[0])).to.equal('seed1.js');
      expect(path.basename(data[1])).to.equal('seed2.js');
    });

    it('should run specific seed file in the configured seed directory', async () => {
      const [data] = await knex.seed.run({
        directory: 'test/integration/seed/test',
        specific: 'seed2.js',
      });

      expect(data.length).to.equal(1);
      expect(path.basename(data[0])).to.equal('seed2.js');
    });

    it('should run specific seed files in the correct order', async () => {
      const [data] = await knex.seed.run({
        directory: 'test/integration/seed/test',
        specific: ['seed2.js', 'seed1.js'],
      });

      expect(data.length).to.equal(2);
      expect(path.basename(data[0])).to.equal('seed2.js');
      expect(path.basename(data[1])).to.equal('seed1.js');
    });
  });
};
