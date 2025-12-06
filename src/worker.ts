// worker.ts
import { PGlite } from "@electric-sql/pglite";
import { OpfsAhpFS } from "@electric-sql/pglite/opfs-ahp";
import { drizzle } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import { users } from './db/schema';

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

interface CloseDbMessage {
  type: 'closeDb';
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

type WorkerMessage = AddUserMessage | DeleteUserMessage | UpdateUserMessage | GetUsersMessage | CloseDbMessage;

const logHtml = function (cssClass: string, ...args: string[]): void {
  postMessage({
    type: 'log',
    payload: { cssClass, args },
  } as LogMessage);
};

const log = (...args: string[]): void => logHtml('', ...args);
const error = (...args: string[]): void => logHtml('error', ...args);

const fs = new OpfsAhpFS("my-pgdata");  // directory inside OPFS
const client = new PGlite({ fs });
const db = drizzle(client, { schema: { users } });

async function initDb() {
  // Provide an OPFS-based directory for persistence
  log("Initializing database...");
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT,
      email TEXT,
      age INT
    );
  `);

  const allUsers = await db.select().from(users);
  // Send results back to main thread or do something with them
  log("Users", JSON.stringify(allUsers));
}

// Database operation functions
const addUser = async (name: string, email: string, age: number): Promise<void> => {
  if (!db) {
    error('Database not initialized');
    return;
  }

  try {
    await db.insert(users).values({ name, email, age });
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
    await db.delete(users).where(eq(users.id, id));
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
    const updateData: Partial<{ name: string; email: string; age: number }> = {};
    
    if (name !== undefined) {
      updateData.name = name;
    }
    if (email !== undefined) {
      updateData.email = email;
    }
    if (age !== undefined) {
      updateData.age = age;
    }
    
    if (Object.keys(updateData).length === 0) {
      error('No fields to update');
      return;
    }
    
    await db.update(users).set(updateData).where(eq(users.id, id));
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
    const allUsers = await db.select().from(users).orderBy(users.id);
    
    postMessage({
      type: 'queryResult',
      payload: { users: allUsers },
    } as QueryResultMessage);
    
    log(`Retrieved ${allUsers.length} users`);
  } catch (e) {
    error('Error getting users:', (e as Error).message);
  }
};

const cleanup = async (): Promise<void> => {
  if (client) {
    try {
      await client.close();
      log('Database closed successfully');
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
      const exhaustiveCheck: never = message;
      throw new Error(`Unhandled case: ${exhaustiveCheck}`);
  }
});

log('Loading and initializing PGLite module...');
