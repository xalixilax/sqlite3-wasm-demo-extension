# Troubleshooting OPFS/Database Issues

## Common Error: "disk I/O error" (code 266)

This error occurs when OPFS (Origin Private File System) cannot initialize properly in the Chrome extension context.

## What Was Fixed

### 1. **Better Error Handling**
The worker now gracefully falls back to in-memory storage if OPFS fails:

```typescript
// Try OPFS first (persistent storage)
if (sqlite3.opfs) {
  try {
    db = new sqlite3.opfs.OpfsDb('/mydb.sqlite3');
    log('Using OPFS (persistent storage)');
  } catch (opfsError) {
    // Fall back to in-memory if OPFS fails
    db = new oo.DB(':memory:');
    log('Using in-memory database (non-persistent)');
  }
} else {
  // No OPFS available, use in-memory
  db = new oo.DB(':memory:');
  log('OPFS not available, using in-memory database');
}
```

### 2. **Increased Initialization Time**
Changed from 500ms to 1000ms to give SQLite more time to initialize:

```typescript
setTimeout(() => {
  worker.postMessage({ type: "getUsers" });
}, 1000);
```

## Expected Console Output

### ✅ Success with OPFS (Persistent):
```
Loading and initializing sqlite3 module...
Done initializing. Running demo...
sqlite3 version 3.40.0 ...
Using OPFS (persistent storage)
Database opened: /mydb.sqlite3
Table "users" ready
Table is empty, adding sample users
Added 2 sample users
Database ready! Waiting for commands from App
Received command: getUsers
Retrieved 2 users
```

### ✅ Fallback to In-Memory (Non-Persistent):
```
Loading and initializing sqlite3 module...
Done initializing. Running demo...
sqlite3 version 3.40.0 ...
OPFS failed, falling back to in-memory: disk I/O error
Using in-memory database (non-persistent)
Database opened: :memory:
Table "users" ready
Table is empty, adding sample users
Added 2 sample users
Database ready! Waiting for commands from App
Received command: getUsers
Retrieved 2 users
```

### ❌ Before Fix (Would Crash):
```
Loading and initializing sqlite3 module...
Done initializing. Running demo...
sqlite3 version 3.40.0 ...
Exception: sqlite result code 266: disk I/O error
Received command: getUsers
Database not initialized
```

## Why OPFS Might Fail

### 1. **Secure Context Required**
OPFS requires a secure context (HTTPS or localhost). Extensions should work, but some Chrome versions/settings may block it.

### 2. **Storage Quota**
If the origin has exceeded its storage quota, OPFS will fail.

### 3. **Browser Support**
Older Chrome versions may not fully support OPFS in extension contexts.

### 4. **Incognito/Private Mode**
OPFS may be disabled in incognito mode.

## Testing the Fix

```bash
# Rebuild the extension
pnpm run build

# Load in Chrome
# Check console for one of these messages:
```

**Best case (persistent):**
- ✅ "Using OPFS (persistent storage)"
- Data will persist across reloads

**Fallback (working but non-persistent):**
- ⚠️ "Using in-memory database (non-persistent)"
- Database works but data lost on reload

**Failure (should not happen now):**
- ❌ "Database not initialized"
- If you see this, report it!

## Forcing Persistent Storage

If you're getting the in-memory fallback but want persistent storage:

### Option 1: Check Chrome Flags
```
chrome://flags/#unsafely-treat-insecure-origin-as-secure
```

### Option 2: Use File System Access API Alternative
If OPFS consistently fails, you could implement a backup using:
- Chrome storage API (limited to ~5MB)
- IndexedDB (with VFS adapter)
- Download/upload database file manually

### Option 3: Debug OPFS Availability
Add this to check OPFS support:

```typescript
// In worker.ts
log('OPFS available:', !!sqlite3.opfs);
log('Storage API:', !!navigator.storage);

if (navigator.storage && navigator.storage.estimate) {
  navigator.storage.estimate().then(estimate => {
    log('Storage quota:', estimate.quota);
    log('Storage usage:', estimate.usage);
  });
}
```

## Storage Modes Comparison

| Mode               | Persistent | Speed   | Quota     | Use Case     |
| ------------------ | ---------- | ------- | --------- | ------------ |
| **OPFS**           | ✅ Yes      | Fast    | ~60% disk | Production   |
| **In-Memory**      | ❌ No       | Fastest | RAM only  | Testing/Demo |
| **Chrome Storage** | ✅ Yes      | Slower  | ~5MB      | Small data   |

## Current Behavior

The extension now:
1. **Tries OPFS first** → Best option (persistent + fast)
2. **Falls back to in-memory** → Works but data lost on reload
3. **Always succeeds** → No more crashes!

Check the console logs to see which mode is active.

## Need True Persistence?

If the in-memory fallback is being used and you need persistence:

### Add Chrome Storage Sync as Secondary Backup:

```typescript
// Save to Chrome storage after operations
const syncToStorage = (users: User[]) => {
  chrome.storage.local.set({ 'users_backup': users });
};

// Load from Chrome storage on startup
const loadFromStorage = () => {
  chrome.storage.local.get(['users_backup'], (result) => {
    if (result.users_backup) {
      // Restore users to in-memory database
    }
  });
};
```

This provides persistence even if OPFS fails, though with some limitations on data size.
