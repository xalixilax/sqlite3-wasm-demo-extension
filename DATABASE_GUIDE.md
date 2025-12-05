# SQLite Database Management Guide

This guide shows you how to manage your SQLite database in this project.

## Table of Contents
1. [Basic Operations](#basic-operations)
2. [INSERT - Adding Data](#insert---adding-data)
3. [SELECT - Querying Data](#select---querying-data)
4. [UPDATE - Modifying Data](#update---modifying-data)
5. [DELETE - Removing Data](#delete---removing-data)
6. [Advanced Patterns](#advanced-patterns)

## Basic Operations

### Database Connection
```typescript
// The database is opened in worker.ts
let db: Database;
if (sqlite3.opfs) {
  db = new sqlite3.opfs.OpfsDb('/mydb.sqlite3'); // Persistent storage
} else {
  db = new oo.DB('/mydb.sqlite3', 'ct'); // In-memory fallback
}
```

### Creating Tables
```typescript
// Create a table with columns
db.exec('CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT, email TEXT, age INTEGER)');

// Multiple columns with constraints
db.exec(`
  CREATE TABLE IF NOT EXISTS products(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL,
    stock INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);
```

## INSERT - Adding Data

### Insert Single Row
```typescript
// Using parameterized query (recommended - prevents SQL injection)
db.exec({
  sql: 'INSERT INTO users(name, email, age) VALUES (?, ?, ?)',
  bind: ['John Doe', 'john@example.com', 25],
});
```

### Insert Multiple Rows
```typescript
const users = [
  ['Alice', 'alice@example.com', 30],
  ['Bob', 'bob@example.com', 28],
  ['Charlie', 'charlie@example.com', 35],
];

for (const user of users) {
  db.exec({
    sql: 'INSERT INTO users(name, email, age) VALUES (?, ?, ?)',
    bind: user,
  });
}
```

### Insert with Specific ID
```typescript
db.exec({
  sql: 'INSERT INTO users(id, name, email, age) VALUES (?, ?, ?, ?)',
  bind: [100, 'Diana', 'diana@example.com', 27],
});
```

## SELECT - Querying Data

### Get All Records
```typescript
db.exec({
  sql: 'SELECT * FROM users',
  rowMode: 'object', // Returns objects with column names
  callback: function (row) {
    const user = row as Record<string, unknown>;
    console.log(user.name, user.email, user.age);
  },
});
```

### Query with WHERE Clause
```typescript
// Single condition
db.exec({
  sql: 'SELECT * FROM users WHERE age > ?',
  bind: [30],
  rowMode: 'object',
  callback: function (row) {
    console.log(row);
  },
});

// Multiple conditions
db.exec({
  sql: 'SELECT * FROM users WHERE age > ? AND name LIKE ?',
  bind: [25, '%Alice%'],
  rowMode: 'object',
  callback: function (row) {
    console.log(row);
  },
});
```

### Query Specific Columns
```typescript
db.exec({
  sql: 'SELECT name, email FROM users WHERE age >= ?',
  bind: [18],
  rowMode: 'object',
  callback: function (row) {
    const user = row as Record<string, unknown>;
    log(`${user.name}: ${user.email}`);
  },
});
```

### Ordering and Limiting Results
```typescript
// Order by age, limit to 10 results
db.exec({
  sql: 'SELECT * FROM users ORDER BY age DESC LIMIT ?',
  bind: [10],
  rowMode: 'object',
  callback: function (row) {
    console.log(row);
  },
});
```

### Counting Records
```typescript
db.exec({
  sql: 'SELECT COUNT(*) as total FROM users WHERE age > ?',
  bind: [30],
  rowMode: 'object',
  callback: function (row) {
    const result = row as Record<string, unknown>;
    console.log(`Total users: ${result.total}`);
  },
});
```

### Using Array Row Mode
```typescript
db.exec({
  sql: 'SELECT name, age FROM users',
  rowMode: 'array', // Returns arrays instead of objects
  callback: function (row) {
    const [name, age] = row as [string, number];
    console.log(`${name} is ${age} years old`);
  },
});
```

## UPDATE - Modifying Data

### Update Single Record
```typescript
db.exec({
  sql: 'UPDATE users SET age = ? WHERE name = ?',
  bind: [31, 'Alice'],
});
```

### Update Multiple Columns
```typescript
db.exec({
  sql: 'UPDATE users SET email = ?, age = ? WHERE id = ?',
  bind: ['newemail@example.com', 26, 5],
});
```

### Update with Conditions
```typescript
// Increment age for all users over 30
db.exec({
  sql: 'UPDATE users SET age = age + 1 WHERE age > ?',
  bind: [30],
});
```

### Update All Records (Be Careful!)
```typescript
// This updates ALL records - use with caution
db.exec('UPDATE users SET active = 1');
```

## DELETE - Removing Data

### Delete Specific Record
```typescript
db.exec({
  sql: 'DELETE FROM users WHERE id = ?',
  bind: [5],
});
```

### Delete by Name
```typescript
db.exec({
  sql: 'DELETE FROM users WHERE name = ?',
  bind: ['Bob'],
});
```

### Delete with Conditions
```typescript
// Delete users younger than 18
db.exec({
  sql: 'DELETE FROM users WHERE age < ?',
  bind: [18],
});

// Delete multiple conditions
db.exec({
  sql: 'DELETE FROM users WHERE age < ? OR email LIKE ?',
  bind: [18, '%spam%'],
});
```

### Delete All Records (Be Careful!)
```typescript
// This deletes ALL records from the table
db.exec('DELETE FROM users');
```

### Drop Table (Complete Deletion)
```typescript
// This completely removes the table and all its data
db.exec('DROP TABLE IF EXISTS users');
```

## Advanced Patterns

### Transactions (All or Nothing)
```typescript
try {
  db.exec('BEGIN TRANSACTION');
  
  db.exec({
    sql: 'INSERT INTO users(name, email, age) VALUES (?, ?, ?)',
    bind: ['Test User', 'test@example.com', 25],
  });
  
  db.exec({
    sql: 'UPDATE users SET age = ? WHERE name = ?',
    bind: [26, 'Test User'],
  });
  
  db.exec('COMMIT');
  log('Transaction completed successfully');
} catch (error) {
  db.exec('ROLLBACK');
  log('Transaction rolled back due to error');
}
```

### Joins (Combining Tables)
```typescript
// Create related tables
db.exec(`
  CREATE TABLE IF NOT EXISTS orders(
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    product TEXT,
    quantity INTEGER
  )
`);

// Insert some orders
db.exec({
  sql: 'INSERT INTO orders(user_id, product, quantity) VALUES (?, ?, ?)',
  bind: [1, 'Laptop', 2],
});

// Join users with their orders
db.exec({
  sql: `
    SELECT users.name, orders.product, orders.quantity
    FROM users
    INNER JOIN orders ON users.id = orders.user_id
  `,
  rowMode: 'object',
  callback: function (row) {
    console.log(row);
  },
});
```

### Aggregations
```typescript
// Group by and aggregate
db.exec({
  sql: `
    SELECT age, COUNT(*) as count, AVG(age) as avg_age
    FROM users
    GROUP BY age
    HAVING count > 1
  `,
  rowMode: 'object',
  callback: function (row) {
    console.log(row);
  },
});
```

### Check if Record Exists
```typescript
let exists = false;
db.exec({
  sql: 'SELECT COUNT(*) as count FROM users WHERE email = ?',
  bind: ['alice@example.com'],
  rowMode: 'object',
  callback: function (row) {
    const result = row as Record<string, unknown>;
    exists = (result.count as number) > 0;
  },
});
```

### Get Last Inserted ID
```typescript
// SQLite has a last_insert_rowid() function
db.exec({
  sql: 'SELECT last_insert_rowid() as id',
  rowMode: 'object',
  callback: function (row) {
    const result = row as Record<string, unknown>;
    log(`Last inserted ID: ${result.id}`);
  },
});
```

## Best Practices

1. **Always use parameterized queries** (with `bind`) to prevent SQL injection
2. **Use transactions** for multiple related operations
3. **Add indexes** for frequently queried columns
4. **Close the database** when done: `db.close()`
5. **Handle errors** with try-catch blocks
6. **Validate data** before inserting
7. **Use PRIMARY KEY** for better performance
8. **Be careful with DELETE and UPDATE** without WHERE clauses

## Common Patterns for Your Extension

### Initialize Database Schema
```typescript
function initDatabase(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings(
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS logs(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
}
```

### Store Settings
```typescript
function saveSetting(db: Database, key: string, value: string) {
  db.exec({
    sql: 'INSERT OR REPLACE INTO settings(key, value) VALUES (?, ?)',
    bind: [key, value],
  });
}
```

### Retrieve Settings
```typescript
function getSetting(db: Database, key: string): string | null {
  let result: string | null = null;
  db.exec({
    sql: 'SELECT value FROM settings WHERE key = ?',
    bind: [key],
    rowMode: 'object',
    callback: function (row) {
      const r = row as Record<string, unknown>;
      result = r.value as string;
    },
  });
  return result;
}
```

### Add Log Entry
```typescript
function addLog(db: Database, message: string) {
  db.exec({
    sql: 'INSERT INTO logs(message) VALUES (?)',
    bind: [message],
  });
}
```

### Clean Old Logs
```typescript
function cleanOldLogs(db: Database, daysToKeep: number) {
  db.exec({
    sql: `DELETE FROM logs WHERE timestamp < datetime('now', '-' || ? || ' days')`,
    bind: [daysToKeep],
  });
}
```

## Testing Your Changes

1. Build the extension:
   ```bash
   pnpm run build
   ```

2. Load the `dist/` folder as an unpacked extension in Chrome

3. Open the extension and check the console output to see the database operations

4. The current `worker.ts` demonstrates all these operations with a `users` table
