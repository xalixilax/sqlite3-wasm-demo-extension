console.log('Running demo from Worker thread.');

// Type definitions for SQLite3 WASM API
interface SQLite3 {
  capi: {
    sqlite3_libversion: () => string;
    sqlite3_sourceid: () => string;
  };
  oo1: {
    DB: new (filename: string, flags?: string) => Database;
  };
  opfs?: {
    OpfsDb: new (filename: string) => Database;
  };
}

interface Database {
  filename: string;
  exec(sql: string): void;
  exec(config: {
    sql: string;
    bind?: unknown[];
    rowMode?: 'array' | 'object' | 'stmt';
    callback?: (row: unknown) => void;
  }): void;
  close(): void;
}

interface LogMessage {
  type: 'log';
  payload: {
    cssClass: string;
    args: string[];
  };
}

const logHtml = function (cssClass: string, ...args: string[]): void {
  postMessage({
    type: 'log',
    payload: { cssClass, args },
  } as LogMessage);
};

const log = (...args: string[]): void => logHtml('', ...args);
const error = (...args: string[]): void => logHtml('error', ...args);

const start = function (sqlite3: SQLite3): void {
  const capi = sqlite3.capi; /*C-style API*/
  const oo = sqlite3.oo1; /*high-level OO API*/
  log('sqlite3 version', capi.sqlite3_libversion(), capi.sqlite3_sourceid());
  let db: Database;
  if (sqlite3.opfs) {
    db = new sqlite3.opfs.OpfsDb('/mydb.sqlite3');
    log('The OPFS is available.');
  } else {
    db = new oo.DB('/mydb.sqlite3', 'ct');
    log('The OPFS is not available.');
  }
  log('transient db =', db.filename);

  try {
    log('Create a table...');
    db.exec('CREATE TABLE IF NOT EXISTS t(a,b)');
    log('Insert some data using exec()...');
    let i: number;
    for (i = 20; i <= 25; ++i) {
      db.exec({
        sql: 'insert into t(a,b) values (?,?)',
        bind: [i, i * 2],
      });
    }
    log("Query data with exec() using rowMode 'array'...");
    let counter = 0;
    db.exec({
      sql: 'select a from t order by a limit 3',
      rowMode: 'array', // 'array' (default), 'object', or 'stmt'
      callback: function (row: unknown): void {
        log('row ', String(++counter), '=', String(row));
      },
    });
  } finally {
    db.close();
  }
};

log('Loading and initializing sqlite3 module...');

let sqlite3Js = 'sqlite3.js';
const urlParams = new URL(self.location.href).searchParams;
if (urlParams.has('sqlite3.dir')) {
  sqlite3Js = urlParams.get('sqlite3.dir') + '/' + sqlite3Js;
}
importScripts(sqlite3Js);

// Extend the global scope with sqlite3InitModule
declare const sqlite3InitModule: (config: {
  print: (...args: string[]) => void;
  printErr: (...args: string[]) => void;
}) => Promise<SQLite3>;

sqlite3InitModule({
  print: log,
  printErr: error,
})
  .then(function (sqlite3: SQLite3): void {
    log('Done initializing. Running demo...');
    try {
      start(sqlite3);
    } catch (e) {
      error('Exception:', (e as Error).message);
    }
  });

export {};
