import _ from 'lodash';

export function getCharsetAndCollation(single, connectionSettings, driverName) {
  if (single.charset) {
    return {
      charset: single.charset,
      collation: single.collate || '',
    };
  }
  if (!connectionSettings.charset) {
    return {
      charset: '',
      collation: '',
    };
  }

  return getMappedCharsetAndCollation(
    connectionSettings.charset.toUpperCase(),
    driverName
  );
}

function getMappedCharsetAndCollation(charset, driverName) {
  // This is the map of what the mysql libraries calls charset, which is either
  // character sets which they map to default collations or collations themselves
  let charsetMap;
  let aliases;
  try {
    if (driverName === 'mysql') {
      charsetMap = require('mysql/lib/protocol/constants/charsets');
      aliases = mysqlAliases;
    } else if (driverName === 'mysql2') {
      charsetMap = require('mysql2/lib/constants/charsets');
      aliases = mysql2Aliases;
    }
  } catch (e) {
    // couldn't find the file. In that case we just return what was input
    return {
      charset,
      collation: '',
    };
  }
  // It is important to use toUpperCase as the libraries also support lower case this way
  if (!charsetMap[charset.toUpperCase()]) {
    // We don't recognize this encoding so just return given charset
    return {
      charset,
      collation: '',
    };
  }
  return {
    charset:
      getCharsetFromCollationNumber(charset, charsetMap, aliases) || charset,
    collation:
      getCollationFromCollationNumber(charset, charsetMap, aliases) || '',
  };
}

/**
 * The aliases are different charsets, so we check which alias maps to the
 * collation number our given charset also maps to
 */
function getCharsetFromCollationNumber(charset) {
  return charset.split('_')[0];
}

function getCollationFromCollationNumber(charset, charsetMap, aliases) {
  const isAlias = aliases.find((x) => x === charset) !== undefined;
  if (!isAlias) {
    // It is not an alias which must mean it's a collation
    // we assume that it's been checked previously that the charset
    // is a key in charsetMap
    return charset;
  }
  // It is an alias, so now we must find the default collation for that charset
  return _.findKey(charsetMap, (value, key) => {
    return key !== charset && charsetMap[charset] === value;
  });
}

// Taken from https://github.com/mysqljs/mysql/blob/cf5d1e396a343ffa0fba23b3791d2dd5da20f30e/lib/protocol/constants/charsets.js#L222-L262
const mysqlAliases = [
  'ARMSCII8',
  'ASCII',
  'BIG5',
  'BINARY',
  'CP1250',
  'CP1251',
  'CP1256',
  'CP1257',
  'CP866',
  'CP850',
  'CP852',
  'CP932',
  'DEC8',
  'EUCJPMS',
  'EUCKR',
  'GB2312',
  'GBK',
  'GEOSTD8',
  'GREEK',
  'HEBREW',
  'HP8',
  'KEYBCS2',
  'KOI8R',
  'KOI8U',
  'LATIN1',
  'LATIN2',
  'LATIN5',
  'LATIN7',
  'MACCE',
  'MACROMAN',
  'SJIS',
  'SWE7',
  'TIS620',
  'UCS2',
  'UJIS',
  'UTF16',
  'UTF16LE',
  'UTF8',
  'UTF8MB4',
  'UTF32',
];

// Taken from https://github.com/sidorares/node-mysql2/blob/2e3bb731ab97ac6fdac77c6c2b9cc7633a727118/lib/constants/charsets.js#L247-L288
const mysql2Aliases = [
  'BIG5',
  'DEC8',
  'CP850',
  'HP8',
  'KOI8R',
  'LATIN1',
  'LATIN2',
  'SWE7',
  'ASCII',
  'UJIS',
  'SJIS',
  'HEBREW',
  'TIS620',
  'EUCKR',
  'KOI8U',
  'GB2312',
  'GREEK',
  'CP1250',
  'GBK',
  'LATIN5',
  'ARMSCII8',
  'UTF8',
  'UCS2',
  'CP866',
  'KEYBCS2',
  'MACCE',
  'MACROMAN',
  'CP852',
  'LATIN7',
  'UTF8MB4',
  'CP1251',
  'UTF16',
  'UTF16LE',
  'CP1256',
  'CP1257',
  'UTF32',
  'BINARY',
  'CP932',
  'EUCJPMS',
  'GB18030',
];
