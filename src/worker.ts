// worker.ts
import { PGlite } from "@electric-sql/pglite";
import { OpfsAhpFS } from "@electric-sql/pglite/opfs-ahp";

const logHtml = function (cssClass: string, ...args: string[]): void {
  postMessage({
    type: 'log',
    payload: { cssClass, args },
  } as LogMessage);
};

const log = (...args: string[]): void => logHtml('', ...args);
const error = (...args: string[]): void => logHtml('error', ...args);

let db: PGlite | null = null;

async function initDb() {
  // Provide an OPFS-based directory for persistence
  const fs = new OpfsAhpFS("my-pgdata");  // directory inside OPFS
  db = new PGlite({ fs });

  log("Initializing database...");
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT,
      email TEXT,
      age INT
    );
  `);

  const { rows } = await db.query("SELECT * FROM users;");
  // Send results back to main thread or do something with them
  log("Users", JSON.stringify({ rows }));
}

// Database operation functions
const addUser = async (name: string, email: string, age: number): Promise<void> => {
  if (!db) {
    error('Database not initialized');
    return;
  }
  
  try {
    await db.query('INSERT INTO users(name, email, age) VALUES ($1, $2, $3)', [name, email, age]);
    log(`Added user: ${name}`);
    getUsers();   
  } catch (e) {
    error('Error adding user:', (e as Error).message);
  }
};
const deleteUser = async (id: number): Promise<void> => {
  if (!db) {
    error('Database not initialized');
    return;
  }
  
  try {
    await db.query('DELETE FROM users WHERE id = $1', [id]);
    log(`Deleted user with ID: ${id}`);
    getUsers();
  } catch (e) {
    error('Error deleting user:', (e as Error).message);
  }
};
const updateUser = async (id: number, name?: string, email?: string, age?: number): Promise<void> => {
  if (!db) {
    error('Database not initialized');
    return;
  }
  
  try {
    const updates: string[] = [];
    const bindings: unknown[] = [];
    let paramCount = 1;
    
    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      bindings.push(name);
    }
    if (email !== undefined) {
      updates.push(`email = $${paramCount++}`);
      bindings.push(email);
    }
    if (age !== undefined) {
      updates.push(`age = $${paramCount++}`);
      bindings.push(age);
    }
    
    if (updates.length === 0) {
      error('No fields to update');
      return;
    }
    
    bindings.push(id);
    
    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount}`, bindings);
    log(`Updated user with ID: ${id}`);
    getUsers();
  } catch (e) {
    error('Error updating user:', (e as Error).message);
  }
};
const getUsers = async (): Promise<void> => {
  if (!db) {
    error('Database not initialized');
    return;
  }
  
  try {
    const result = await db.query('SELECT * FROM users ORDER BY id');
    const users = result.rows as Array<{ id: number; name: string; email: string; age: number }>;
    
    postMessage({
      type: 'queryResult',
      payload: { users },
    } as QueryResultMessage);
    
    log(`Retrieved ${users.length} users`);
  } catch (e) {
    error('Error getting users:', (e as Error).message);
  }
};

const cleanup = async (): Promise<void> => {
  if (db) {
    try {
      await db.close();
      log('Database closed successfully');
      db = null;
    } catch (e) {
      error('Error closing database:', (e as Error).message);
    }
  }
};

initDb().catch(err => {
  error("Error initialising DB",err.message);
});

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
    case 'closeDb':
      cleanup();
      break;
    default:
      error('Unknown message type');
  }
});

log('Loading and initializing PGLite module...');
