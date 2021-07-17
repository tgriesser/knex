const Knex = require('../../lib');

const toxiproxy = require('toxiproxy-node-client');
const toxicli = new toxiproxy.Toxiproxy('http://localhost:8474');
const rp = require('request-promise-native');
const delay = require('../../lib/execution/internal/delay');

// init instances
const pg = Knex({
  client: 'pg',
  connection:
    'postgres://postgres:postgresrootpassword@localhost:25432/postgres',
  pool: { max: 50 },
});

const pgnative = Knex({
  client: 'pgnative',
  connection:
    'postgres://postgres:postgresrootpassword@localhost:25433/postgres',
  pool: { max: 50 },
});

const mysql2 = Knex({
  client: 'mysql2',
  connection:
    'mysql://root:mysqlrootpassword@localhost:23306/?charset=utf8&connectTimeout=500',
  pool: { max: 50 },
});

const mysql = Knex({
  client: 'mysql',
  connection:
    'mysql://root:mysqlrootpassword@localhost:23306/?charset=utf8&connectTimeout=500',
  pool: { max: 50 },
});

const mssql = Knex({
  client: 'mssql',
  connection: {
    port: 21433,
    user: 'sa',
    password: 'S0meVeryHardPassword',
    server: 'localhost',
    requestTimeout: 500,
  },
  pool: { max: 50 },
});

/* TODO: figure out how to nicely install oracledb node driver on osx
const oracledb = Knex({
  client: 'oracledb',
  connection: {
    user          : "travis",
    password      : "travis",
    connectString : "localhost/XE",
    // https://github.com/oracle/node-oracledb/issues/525
    stmtCacheSize : 0
  },
  pool: { max: 50 }
});
*/

const counters = {};

function setQueryCounters(instance, name) {
  const counts = (counters[name] = { queries: 0, results: 0, errors: 0 });
  instance.on('query', () => (counts.queries += 1));
  instance.on('query-response', () => (counts.results += 1));
  instance.on('query-error', () => (counts.errors += 1));
}

setQueryCounters(pg, 'pg');
setQueryCounters(mysql, 'mysql');
setQueryCounters(mysql2, 'mysql2');
setQueryCounters(mssql, 'mssql');

const _ = require('lodash');

// start printing out counters
let lastCounters = _.cloneDeep(counters);

setInterval(() => {
  const reqsPerSec = {};
  for (let key of Object.keys(counters)) {
    reqsPerSec[key] = {
      queries: (counters[key].queries - lastCounters[key].queries) / 2,
      results: (counters[key].results - lastCounters[key].results) / 2,
      errors: (counters[key].errors - lastCounters[key].errors) / 2,
    };
  }
  console.log(
    '------------------------ STATS PER SECOND ------------------------'
  );
  console.dir(reqsPerSec, { colors: true });
  console.log(
    '------------------------------- EOS ------------------------------'
  );
  lastCounters = _.cloneDeep(counters);
}, 2000);

async function killConnectionsPg(client) {
  return client.raw(`SELECT pg_terminate_backend(pg_stat_activity.pid)
    FROM pg_stat_activity
    WHERE pg_stat_activity.datname = 'postgres'
      AND pid <> pg_backend_pid()`);
}

async function killConnectionsMyslq(client) {
  const [rows, colDefs] = await client.raw(`SHOW FULL PROCESSLIST`);
  await Promise.all(rows.map((row) => client.raw(`KILL ${row.Id}`)));
}

async function killConnectionsMssql() {
  const rows = await mssql('sys.dm_exec_sessions').select('session_id');
  await Promise.all(rows.map((row) => mssql.raw(`KILL ${row.session_id}`)));
}

async function main() {
  async function loopQueries(prefix, query) {
    const queries = () => [...Array(50).fill(query)];

    while (true) {
      try {
        await Promise.all(queries());
      } catch (err) {
        console.log(prefix, err);
      }
    }
  }

  async function recreateProxy(serviceName, listenPort, proxyToPort) {
    try {
      await rp.delete({
        url: `${toxicli.host}/proxies/${serviceName}`,
      });
    } catch (err) {}

    const proxy = await toxicli.createProxy({
      name: serviceName,
      listen: `0.0.0.0:${listenPort}`,
      upstream: `${serviceName}:${proxyToPort}`,
    });

    // add some latency
    await proxy.addToxic(
      new toxiproxy.Toxic(proxy, {
        type: 'latency',
        attributes: { latency: 1, jitter: 1 },
      })
    );

    // cause connections to be closed every 500 bytes
    await proxy.addToxic(
      new toxiproxy.Toxic(proxy, {
        type: 'limit_data',
        attributes: { bytes: 5000 },
      })
    );
  }

  // create TCP proxies for simulating bad connections etc.
  async function recreateProxies() {
    await recreateProxy('postgresql', 25432, 5432);
    await recreateProxy('postgresql', 25433, 5433);
    await recreateProxy('mysql', 23306, 3306);
    await recreateProxy('oracledbxe', 21521, 1521);
    await recreateProxy('mssql', 21433, 1433);
  }

  await recreateProxies();

  loopQueries('PSQL:', pg.raw('select 1'));
  loopQueries('PSQL TO:', pg.raw('select 1').timeout(20));

  loopQueries('PGNATIVE:', pgnative.raw('select 1'));
  loopQueries('PGNATIVE TO:', pgnative.raw('select 1').timeout(20));

  loopQueries('MYSQL:', mysql.raw('select 1'));
  loopQueries('MYSQL TO:', mysql.raw('select 1').timeout(20));

  // mysql2 still crashes app (without connection killer nor timeouts)
  // https://github.com/sidorares/node-mysql2/issues/731
  //  loopQueries('MYSQL2:', mysql2.raw('select 1'));
  //  loopQueries('MYSQL2 TO:', mysql2.raw('select 1').timeout(20));

  loopQueries('MSSQL:', mssql.raw('select 1'));
  loopQueries('MSSQL TO:', mssql.raw('select 1').timeout(20));

  setInterval(recreateProxies, 2000);

  while (true) {
    await delay(20); // kill everything every quite often from server side
    try {
      await Promise.all([
        killConnectionsPg(pg),
        killConnectionsPg(pgnative),
        killConnectionsMyslq(mysql),
        //        killConnectionsMyslq(mysql2),
        killConnectionsMssql(),
      ]);
    } catch (err) {
      console.log('KILLER ERROR:', err);
    }
  }
}

process.on('exit', () => console.log('- STATS PRINT NEAR END LOGS ')); // marker for grep...
main();
