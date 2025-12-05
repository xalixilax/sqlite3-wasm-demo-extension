# How to Send Data from App to Worker

This guide explains the two-way communication setup between your React App and the Web Worker for database operations.

## Architecture Overview

```
App.tsx (React UI) <---messages---> worker.ts (SQLite Database)
```

- **App.tsx**: User interface with forms and tables
- **worker.ts**: Handles all database operations in a Web Worker

## Message Flow

### 1. App → Worker (Commands)

The App sends commands to the worker using `postMessage`:

```typescript
workerRef.current?.postMessage({
  type: "addUser",
  payload: {
    name: "John",
    email: "john@example.com",
    age: 30,
  },
});
```

### 2. Worker → App (Responses)

The worker sends back results:

```typescript
postMessage({
  type: 'queryResult',
  payload: { users },
});
```

## Available Commands

### Add User
```typescript
workerRef.current?.postMessage({
  type: "addUser",
  payload: {
    name: string,
    email: string,
    age: number,
  },
});
```

### Delete User
```typescript
workerRef.current?.postMessage({
  type: "deleteUser",
  payload: {
    id: number,
  },
});
```

### Update User
```typescript
workerRef.current?.postMessage({
  type: "updateUser",
  payload: {
    id: number,
    name?: string,      // Optional
    email?: string,     // Optional
    age?: number,       // Optional
  },
});
```

### Get All Users
```typescript
workerRef.current?.postMessage({
  type: "getUsers",
});
```

## How It Works

### In App.tsx:

1. **Create Worker Reference**:
```typescript
const workerRef = useRef<Worker | null>(null);
```

2. **Initialize Worker**:
```typescript
useEffect(() => {
  const worker = new Worker("/worker.js?sqlite3.dir=jswasm");
  workerRef.current = worker;

  worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
    // Handle messages from worker
  };

  return () => {
    worker.terminate();
  };
}, []);
```

3. **Send Commands**:
```typescript
const handleAddUser = () => {
  workerRef.current?.postMessage({
    type: "addUser",
    payload: { name, email, age },
  });
};
```

4. **Receive Results**:
```typescript
worker.onmessage = ({ data }: MessageEvent) => {
  switch (data.type) {
    case "queryResult":
      setUsers(data.payload.users);
      break;
    case "log":
      setLogs((prev) => [...prev, data.payload]);
      break;
  }
};
```

### In worker.ts:

1. **Listen for Messages**:
```typescript
self.addEventListener('message', (event: MessageEvent) => {
  const message = event.data as WorkerMessage;
  
  switch (message.type) {
    case 'addUser':
      addUser(message.payload.name, message.payload.email, message.payload.age);
      break;
    // ... other cases
  }
});
```

2. **Perform Database Operation**:
```typescript
const addUser = (name: string, email: string, age: number): void => {
  db.exec({
    sql: 'INSERT INTO users(name, email, age) VALUES (?, ?, ?)',
    bind: [name, email, age],
  });
  getUsers(); // Send updated list back to App
};
```

3. **Send Results Back**:
```typescript
const getUsers = (): void => {
  const users: User[] = [];
  
  db.exec({
    sql: 'SELECT * FROM users ORDER BY id',
    rowMode: 'object',
    callback: (row) => {
      users.push(row);
    },
  });
  
  // Send to App
  postMessage({
    type: 'queryResult',
    payload: { users },
  });
};
```

## Adding New Commands

To add a new database operation:

### 1. Define Message Type in worker.ts:
```typescript
interface SearchUserMessage {
  type: 'searchUser';
  payload: {
    searchTerm: string;
  };
}

type WorkerMessage = AddUserMessage | DeleteUserMessage | SearchUserMessage /* add here */;
```

### 2. Add Handler Function:
```typescript
const searchUser = (searchTerm: string): void => {
  if (!db) return;
  
  const users: User[] = [];
  db.exec({
    sql: 'SELECT * FROM users WHERE name LIKE ?',
    bind: [`%${searchTerm}%`],
    rowMode: 'object',
    callback: (row) => {
      users.push(row as User);
    },
  });
  
  postMessage({
    type: 'queryResult',
    payload: { users },
  });
};
```

### 3. Add to Message Listener:
```typescript
self.addEventListener('message', (event: MessageEvent) => {
  const message = event.data as WorkerMessage;
  
  switch (message.type) {
    case 'searchUser':
      searchUser(message.payload.searchTerm);
      break;
    // ... other cases
  }
});
```

### 4. Call from App:
```typescript
const handleSearch = (term: string) => {
  workerRef.current?.postMessage({
    type: "searchUser",
    payload: { searchTerm: term },
  });
};
```

## Complete Example Flow

**User clicks "Add User" button:**

1. **App.tsx** - User fills form and clicks button
   ```typescript
   handleAddUser() // Called
   ```

2. **App.tsx** - Sends message to worker
   ```typescript
   workerRef.current?.postMessage({
     type: "addUser",
     payload: { name: "Jane", email: "jane@...", age: 25 }
   })
   ```

3. **worker.ts** - Receives message
   ```typescript
   addEventListener('message', ...) // Triggered
   ```

4. **worker.ts** - Executes database operation
   ```typescript
   addUser("Jane", "jane@...", 25)
   db.exec('INSERT INTO users...')
   ```

5. **worker.ts** - Fetches updated list
   ```typescript
   getUsers() // Automatically called
   ```

6. **worker.ts** - Sends results back
   ```typescript
   postMessage({ type: 'queryResult', payload: { users } })
   ```

7. **App.tsx** - Receives results
   ```typescript
   worker.onmessage = ({ data }) => {
     setUsers(data.payload.users) // UI updates!
   }
   ```

8. **App.tsx** - UI re-renders with new user

## Testing

1. Build the extension:
   ```bash
   pnpm run build
   ```

2. Load in Chrome:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/` folder

3. Click the extension icon

4. Try the UI:
   - Add a new user using the form
   - Click "Refresh" to get latest users
   - Edit or Delete users from the table
   - Check the console logs at the bottom

## Key Benefits

✅ **Non-blocking**: Database operations don't freeze the UI
✅ **Type-safe**: Full TypeScript type checking
✅ **Separation**: UI logic separate from database logic
✅ **Persistent**: Data survives page reloads (when using OPFS)
✅ **Real-time**: Automatic UI updates after operations
