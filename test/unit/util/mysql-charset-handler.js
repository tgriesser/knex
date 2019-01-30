'use strict';
/*global expect, describe, it*/
const {
  getCharsetAndCollation,
} = require('../../../lib/dialects/mysql/schema/charset-handler');
const chai = require('chai');

describe('getCharsetAndCollation', function() {
  describe('driver: mysql', () => {
    it('handles receiving an alias as charset, gets correct default', function() {
      chai
        .expect(getCharsetAndCollation({}, { charset: 'utf8mb4' }, 'mysql'))
        .to.deep.equal({
          charset: 'UTF8MB4',
          collation: 'UTF8MB4_GENERAL_CI',
        });
    });

    it('handles receiving a non-default collation as charset', () => {
      chai
        .expect(
          getCharsetAndCollation({}, { charset: 'utf8mb4_unicode_ci' }, 'mysql')
        )
        .to.deep.equal({
          charset: 'UTF8MB4',
          collation: 'UTF8MB4_UNICODE_CI',
        });
    });

    it('handles receiving a default collation as charset', function() {
      chai
        .expect(
          getCharsetAndCollation({}, { charset: 'utf8mb4_general_ci' }, 'mysql')
        )
        .to.deep.equal({
          charset: 'UTF8MB4',
          collation: 'UTF8MB4_GENERAL_CI',
        });
    });
  });
  describe('driver: mysql2', () => {
    it('handles receiving an alias as charset, gets correct default', function() {
      chai
        .expect(getCharsetAndCollation({}, { charset: 'utf8mb4' }, 'mysql2'))
        .to.deep.equal({
          charset: 'UTF8MB4',
          collation: 'UTF8MB4_GENERAL_CI',
        });
    });

    it('handles receiving a non-default collation as charset', () => {
      chai
        .expect(
          getCharsetAndCollation(
            {},
            { charset: 'utf8mb4_unicode_ci' },
            'mysql2'
          )
        )
        .to.deep.equal({
          charset: 'UTF8MB4',
          collation: 'UTF8MB4_UNICODE_CI',
        });
    });

    it('handles receiving a default collation as charset', function() {
      chai
        .expect(
          getCharsetAndCollation(
            {},
            { charset: 'utf8mb4_general_ci' },
            'mysql2'
          )
        )
        .to.deep.equal({
          charset: 'UTF8MB4',
          collation: 'UTF8MB4_GENERAL_CI',
        });
    });
  });
});
