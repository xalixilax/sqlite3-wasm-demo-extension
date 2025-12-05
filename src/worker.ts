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

// Message types
interface LogMessage {
  type: 'log';
  payload: {
    cssClass: string;
    args: string[];
  };
}

interface AddUserMessage {
  type: 'addUser';
  payload: {
    name: string;
    email: string;
    age: number;
  };
}

interface DeleteUserMessage {
  type: 'deleteUser';
  payload: {
    id: number;
  };
}

interface UpdateUserMessage {
  type: 'updateUser';
  payload: {
    id: number;
    name?: string;
    email?: string;
    age?: number;
  };
}

interface GetUsersMessage {
  type: 'getUsers';
}

interface QueryResultMessage {
  type: 'queryResult';
  payload: {
    users: Array<{
      id: number;
      name: string;
      email: string;
      age: number;
    }>;
  };
}

type WorkerMessage = AddUserMessage | DeleteUserMessage | UpdateUserMessage | GetUsersMessage;

const logHtml = function (cssClass: string, ...args: string[]): void {
  postMessage({
    type: 'log',
    payload: { cssClass, args },
  } as LogMessage);
};

const log = (...args: string[]): void => logHtml('', ...args);
const error = (...args: string[]): void => logHtml('error', ...args);

// Global database instance
let db: Database | null = null;

// Initialize database
const initDatabase = function (sqlite3: SQLite3): void {
  const capi = sqlite3.capi;
  const oo = sqlite3.oo1;
  log('sqlite3 version', capi.sqlite3_libversion(), capi.sqlite3_sourceid());
  
  if (sqlite3.opfs) {
    db = new sqlite3.opfs.OpfsDb('/mydb.sqlite3');
    log('The OPFS is available.');
  } else {
    db = new oo.DB('/mydb.sqlite3', 'ct');
    log('The OPFS is not available.');
  }
  log('Database opened:', db.filename);

  try {
    log('--- Setting up database schema ---');
    db.exec('DROP TABLE IF EXISTS users');
    log('Dropped old users table if it existed');
    
    db.exec('CREATE TABLE users(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, age INTEGER)');
    log('Table "users" created successfully');
    
    // Add sample data
    log('--- Adding sample users ---');
    const sampleUsers = [
      ['Alice', 'alice@example.com', 30],
      ['Bob', 'bob@example.com', 25],
    ];
    
    for (const user of sampleUsers) {
      db.exec({
        sql: 'INSERT INTO users(name, email, age) VALUES (?, ?, ?)',
        bind: user,
      });
    }
    log(`Added ${sampleUsers.length} sample users`);
    log('--- Database ready! Waiting for commands from App ---');
    
  } catch (e) {
    error('Error initializing database:', (e as Error).message);
  }
};

// Database operation functions
const addUser = (name: string, email: string, age: number): void => {
  if (!db) {
    error('Database not initialized');
    return;
  }
  
  try {
    db.exec({
      sql: 'INSERT INTO users(name, email, age) VALUES (?, ?, ?)',
      bind: [name, email, age],
    });
    log(`Added user: ${name}`);
    getUsers();
  } catch (e) {
    error('Error adding user:', (e as Error).message);
  }
};

const deleteUser = (id: number): void => {
  if (!db) {
    error('Database not initialized');
    return;
  }
  
  try {
    db.exec({
      sql: 'DELETE FROM users WHERE id = ?',
      bind: [id],
    });
    log(`Deleted user with ID: ${id}`);
    getUsers();
  } catch (e) {
    error('Error deleting user:', (e as Error).message);
  }
};

const updateUser = (id: number, name?: string, email?: string, age?: number): void => {
  if (!db) {
    error('Database not initialized');
    return;
  }
  
  try {
    const updates: string[] = [];
    const bindings: unknown[] = [];
    
    if (name !== undefined) {
      updates.push('name = ?');
      bindings.push(name);
    }
    if (email !== undefined) {
      updates.push('email = ?');
      bindings.push(email);
    }
    if (age !== undefined) {
      updates.push('age = ?');
      bindings.push(age);
    }
    
    if (updates.length === 0) {
      error('No fields to update');
      return;
    }
    
    bindings.push(id);
    
    db.exec({
      sql: `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      bind: bindings,
    });
    log(`Updated user with ID: ${id}`);
    getUsers();
  } catch (e) {
    error('Error updating user:', (e as Error).message);
  }
};

const getUsers = (): void => {
  if (!db) {
    error('Database not initialized');
    return;
  }
  
  try {
    const users: Array<{ id: number; name: string; email: string; age: number }> = [];
    
    db.exec({
      sql: 'SELECT * FROM users ORDER BY id',
      rowMode: 'object',
      callback: function (row: unknown): void {
        const user = row as { id: number; name: string; email: string; age: number };
        users.push(user);
      },
    });
    
    postMessage({
      type: 'queryResult',
      payload: { users },
    } as QueryResultMessage);
    
    log(`Retrieved ${users.length} users`);
  } catch (e) {
    error('Error getting users:', (e as Error).message);
  }
};

// Handle messages from the App
self.addEventListener('message', (event: MessageEvent) => {
  const message = event.data as WorkerMessage;
  
  log(`Received command: ${message.type}`);
  
  switch (message.type) {
    case 'addUser':
      addUser(message.payload.name, message.payload.email, message.payload.age);
      break;
    case 'deleteUser':
      deleteUser(message.payload.id);
      break;
    case 'updateUser':
      updateUser(message.payload.id, message.payload.name, message.payload.email, message.payload.age);
      break;
    case 'getUsers':
      getUsers();
      break;
    default:
      error('Unknown message type');
  }
});

log('Loading and initializing sqlite3 module...');

let sqlite3Js = 'sqlite3.js';
const urlParams = new URL(self.location.href).searchParams;
if (urlParams.has('sqlite3.dir')) {
  sqlite3Js = urlParams.get('sqlite3.dir') + '/' + sqlite3Js;
}
importScripts(sqlite3Js);

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
      initDatabase(sqlite3);
    } catch (e) {
      error('Exception:', (e as Error).message);
    }
  });

