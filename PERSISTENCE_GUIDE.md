# Database Persistence Guide

## How Persistence Works

Your SQLite database now **persists data** across page reloads and browser restarts using OPFS (Origin Private File System).

## What Changed

### Before (Non-Persistent):
```typescript
// ❌ Deleted everything on every load
db.exec('DROP TABLE IF EXISTS users');
db.exec('CREATE TABLE users(...)');
// Always added sample data
```

### After (Persistent):
```typescript
// ✅ Keeps existing data
db.exec('CREATE TABLE IF NOT EXISTS users(...)');
// Only adds sample data if table is empty
if (userCount === 0) {
  // Add sample users
}
```

## Key Changes Made

### 1. In `worker.ts`:

#### Removed Table Dropping:
```typescript
// ❌ REMOVED - This deleted all data
// db.exec('DROP TABLE IF EXISTS users');
```

#### Changed to Conditional Creation:
```typescript
// ✅ Only creates if doesn't exist - preserves data
db.exec('CREATE TABLE IF NOT EXISTS users(...)');
```

#### Smart Sample Data:
```typescript
// Check if table has data
let userCount = 0;
db.exec({
  sql: 'SELECT COUNT(*) as count FROM users',
  rowMode: 'object',
  callback: (row) => {
    userCount = (row as { count: number }).count;
  },
});

// Only add sample data if empty
if (userCount === 0) {
  // Add Alice and Bob
} else {
  log(`Table already has ${userCount} user(s)`);
}
```

### 2. In `App.tsx`:

#### Auto-Load Data on Startup:
```typescript
// Load existing data when app starts
const loadDataTimer = setTimeout(() => {
  worker.postMessage({ type: "getUsers" });
}, 500);
```

## How It Works

### First Time (Database Doesn't Exist):

1. Worker initializes
2. OPFS creates new database file: `/mydb.sqlite3`
3. Table doesn't exist → Creates `users` table
4. Table is empty → Adds Alice and Bob
5. App loads and displays: **2 users**

**Console Output:**
```
Database opened: /mydb.sqlite3
Table "users" ready
Table is empty, adding sample users
Added 2 sample users
```

### Subsequent Loads (Database Exists):

1. Worker initializes
2. OPFS opens existing database: `/mydb.sqlite3`
3. Table exists → Skips creation
4. Table has data → Skips sample data
5. App loads existing users

**Console Output:**
```
Database opened: /mydb.sqlite3
Table "users" ready
Table already has 5 user(s), skipping sample data
Database ready!
```

## Storage Location

### With OPFS (Chrome/Edge):
- **Location**: Origin Private File System
- **Path**: `/mydb.sqlite3`
- **Persistent**: ✅ Yes
- **Survives**: Page reloads, browser restarts
- **Quota**: Subject to browser storage quota (~60% of available disk)

### Without OPFS (Fallback):
- **Location**: In-memory
- **Persistent**: ❌ No
- **Survives**: Nothing (lost on page reload)

## Testing Persistence

### Test 1: Add Data and Reload
```bash
1. Build: pnpm run build
2. Load extension in Chrome
3. Add a user: "Charlie, charlie@example.com, 28"
4. Close the extension tab
5. Reopen the extension
6. ✅ Charlie should still be there!
```

### Test 2: Browser Restart
```bash
1. Add several users
2. Close Chrome completely
3. Reopen Chrome
4. Open the extension
5. ✅ All users should still be there!
```

### Test 3: Update Data
```bash
1. Edit a user's age
2. Reload the extension
3. ✅ Updated age should persist
```

## Clearing Persisted Data

If you want to reset the database:

### Option 1: Add a Reset Button in App

In `App.tsx`:
```typescript
const handleResetDatabase = () => {
  if (confirm("Delete all data and reset database?")) {
    workerRef.current?.postMessage({
      type: "resetDatabase",
    });
  }
};
```

In `worker.ts`:
```typescript
const resetDatabase = (): void => {
  if (!db) return;
  
  try {
    db.exec('DROP TABLE IF EXISTS users');
    log('Table dropped');
    
    // Recreate and add sample data
    initDatabase(sqlite3);
  } catch (e) {
    error('Error resetting database:', (e as Error).message);
  }
};

// Add to message handler:
case 'resetDatabase':
  resetDatabase();
  break;
```

### Option 2: Clear Chrome Storage

1. Go to `chrome://extensions/`
2. Find your extension
3. Click "Details"
4. Scroll to "Storage"
5. Click "Clear storage"

### Option 3: Developer Console

```typescript
// In Chrome DevTools Console when extension is open
navigator.storage.estimate().then(console.log); // See usage
```

## Database Size Monitoring

Add this to check database size:

```typescript
const getDatabaseInfo = (): void => {
  if (!db) return;
  
  let count = 0;
  db.exec({
    sql: 'SELECT COUNT(*) as count FROM users',
    rowMode: 'object',
    callback: (row) => {
      count = (row as { count: number }).count;
    },
  });
  
  log(`Database has ${count} users`);
};
```

## Best Practices

### ✅ DO:
- Use `CREATE TABLE IF NOT EXISTS` for persistence
- Check if data exists before adding defaults
- Handle migration scenarios (schema changes)
- Test with browser restarts
- Monitor storage quota for large datasets

### ❌ DON'T:
- Use `DROP TABLE` unless intentionally resetting
- Assume infinite storage (OPFS has limits)
- Store sensitive data without encryption
- Forget to handle database migration on schema changes

## Handling Schema Changes

When you need to modify the table structure:

### Migration Example:

```typescript
// Check current schema version
let schemaVersion = 0;
try {
  db.exec({
    sql: 'SELECT value FROM settings WHERE key = "schema_version"',
    rowMode: 'object',
    callback: (row) => {
      schemaVersion = parseInt((row as { value: string }).value);
    },
  });
} catch {
  // Settings table doesn't exist yet
}

// Migrate if needed
if (schemaVersion < 1) {
  // Add new column
  db.exec('ALTER TABLE users ADD COLUMN phone TEXT');
  db.exec('INSERT OR REPLACE INTO settings(key, value) VALUES ("schema_version", "1")');
  log('Migrated to schema version 1');
}
```

## Verifying Persistence

Check console logs on reload:

**First Load:**
```
Table is empty, adding sample users
Added 2 sample users
```

**Second Load:**
```
Table already has 2 user(s), skipping sample data
```

**After Adding Data:**
```
Table already has 5 user(s), skipping sample data
Retrieved 5 users
```

## Summary

✅ **Database file**: `/mydb.sqlite3` in OPFS  
✅ **Persistence**: Data survives reloads & restarts  
✅ **Auto-initialization**: Creates table only if needed  
✅ **Smart defaults**: Sample data only on first run  
✅ **Auto-load**: Displays existing data on startup  

Your database is now fully persistent! 🎉
