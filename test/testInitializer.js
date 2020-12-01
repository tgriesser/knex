require('anylogger-debug');
const log = require('anylogger')('knex:tests');

let isInitted = false;

function initTests() {
  if (isInitted) {
    return;
  }

  require('source-map-support').install();

  require('./util/chai-setup');

  const EXPECTED_REJECTION_COUNT = 0;
  const rejectionLog = [];
  process.on('unhandledRejection', (reason) => {
    log.error('Unhandled rejection:', reason);
    rejectionLog.push({
      reason,
    });
  });

  process.on('exit', (code) => {
    if (rejectionLog.length) {
      log.error(`Unhandled rejections: ${rejectionLog.length}`);
      rejectionLog.forEach((rejection) => {
        log.error(rejection);
      });

      if (rejectionLog.length > EXPECTED_REJECTION_COUNT) {
        process.exitCode = code || 1;
      }
    }
    log.log('No unhandled exceptions');
  });

  isInitted = true;
}

module.exports = {
  initTests,
};
