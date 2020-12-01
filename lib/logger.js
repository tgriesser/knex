const log = require('anylogger')('knex:log');

const color = require('colorette');
const { inspect } = require('util');
const { isString, isFunction } = require('./util/is');

class Logger {
  constructor(config = {}) {
    const {
      log: {
        debug,
        warn,
        error,
        deprecate,
        inspectionDepth,
        enableColors,
      } = {},
    } = config;
    this._inspectionDepth = inspectionDepth || 5;
    this._enableColors = resolveIsEnabledColors(enableColors);
    this._debug = debug;
    this._warn = warn;
    this._error = error;
    this._deprecate = deprecate;
  }

  _log(level, message, userFn, colorFn) {
    if (userFn != null && !isFunction(userFn)) {
      throw new TypeError('Extensions to knex logger must be functions!');
    }

    if (isFunction(userFn)) {
      userFn(message);
      return;
    }

    if (!isString(message)) {
      message = inspect(message, {
        depth: this._inspectionDepth,
        colors: this._enableColors,
      });
    }

    log[level](colorFn ? colorFn(message) : message);
  }

  debug(message) {
    this._log('debug', message, this._debug);
  }

  warn(message) {
    this._log('warn', message, this._warn, color.yellow);
  }

  error(message) {
    this._log('error', message, this._error, color.red);
  }

  deprecate(method, alternative) {
    const message = `${method} is deprecated, please use ${alternative}`;

    this._log('warn', message, this._deprecate, color.yellow);
  }
}

function resolveIsEnabledColors(enableColorsParam) {
  if (enableColorsParam != null) {
    return enableColorsParam;
  }

  if (process && process.stdout) {
    return process.stdout.isTTY;
  }

  return false;
}

module.exports = Logger;
