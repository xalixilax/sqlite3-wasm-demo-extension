# Type-Safe Worker Router System

This project implements a tRPC-like type-safe routing system for Web Workers, combined with TanStack Query for powerful client-side state management.

## 🎯 Key Features

- **Type-Safe Routes**: Full TypeScript inference from worker to client
- **Runtime Validation**: Zod schemas validate inputs at runtime
- **TanStack Query Integration**: Built-in caching, loading states, and optimistic updates
- **Simple API**: Easy-to-use hooks similar to tRPC

## 📁 Project Structure

```
src/
├── lib/
│   ├── router.ts          # Core router infrastructure
│   ├── workerRoutes.ts    # Worker route definitions
│   └── workerClient.ts    # Client hooks and utilities
├── db/
│   └── schema.ts          # Database schema
├── worker.ts              # Web Worker implementation
└── App.tsx                # React app using the hooks
```

## 🚀 How It Works

### 1. Define Routes in the Worker (`workerRoutes.ts`)

```typescript
import { z } from 'zod';
import { createRouter, query, mutation } from './router';

const addUserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  age: z.number().int().positive(),
});

export const createAppRouter = (context: { db: any; log: Function }) => {
  return createRouter({
    // Query - for data fetching
    getUsers: query({
      handler: async (): Promise<User[]> => {
        return await context.db.select().from(users);
      },
    }),

    // Mutation - for data modification
    addUser: mutation({
      input: addUserSchema,  // Runtime validation
      handler: async (input): Promise<User> => {
        const [newUser] = await context.db
          .insert(users)
          .values(input)
          .returning();
        return newUser;
      },
    }),
  });
};

export type AppRouter = ReturnType<typeof createAppRouter>;
```

### 2. Set Up the Worker (`worker.ts`)

```typescript
import { createWorkerHandler } from './lib/router';
import { createAppRouter } from './lib/workerRoutes';

// Initialize your database and context
const db = /* your db instance */;
const router = createAppRouter({ db, log: console.log });
const handleRequest = createWorkerHandler(router);

// Handle incoming requests
self.addEventListener('message', async (event) => {
  if (event.data.route) {
    const response = await handleRequest(event.data);
    postMessage(response);
  }
});
```

### 3. Use in React with TanStack Query (`App.tsx`)

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUsers, useAddUser, useUpdateUser, useDeleteUser } from './lib/workerClient';

const queryClient = new QueryClient();

function UserManager() {
  // Type-safe query hook
  const { data: users, isLoading, error, refetch } = useUsers();
  
  // Type-safe mutation hooks
  const addUserMutation = useAddUser();
  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();

  const handleAddUser = async () => {
    await addUserMutation.mutateAsync({
      name: "John",
      email: "john@example.com",
      age: 30
    });
    // Queries automatically refetch after mutations!
  };

  return (
    <div>
      {isLoading && <div>Loading...</div>}
      {error && <div>Error: {error.message}</div>}
      
      {users?.map(user => (
        <div key={user.id}>{user.name}</div>
      ))}
      
      <button onClick={handleAddUser}>Add User</button>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserManager />
    </QueryClientProvider>
  );
}
```

## 🔧 API Reference

### Creating Routes

#### `query(config)`
Define a route for data fetching (GET-like operations).

```typescript
query({
  input?: z.ZodType,  // Optional input validation schema
  handler: async (input) => { /* return data */ }
})
```

#### `mutation(config)`
Define a route for data modification (POST/PUT/DELETE-like operations).

```typescript
mutation({
  input?: z.ZodType,  // Optional input validation schema
  handler: async (input) => { /* modify data and return result */ }
})
```

### Client Hooks

#### `useWorkerQuery(route, input, options)`
Generic query hook for any route.

```typescript
const { data, isLoading, error, refetch } = useWorkerQuery('getUsers', undefined);
```

#### `useWorkerMutation(route, options)`
Generic mutation hook for any route.

```typescript
const mutation = useWorkerMutation('addUser', {
  onSuccess: () => console.log('Success!')
});

mutation.mutate({ name: "John", email: "john@example.com", age: 30 });
```

#### Convenience Hooks
Pre-configured hooks for specific routes:

- `useUsers()` - Fetch all users
- `useAddUser()` - Add a new user
- `useUpdateUser()` - Update a user
- `useDeleteUser()` - Delete a user

## ✨ Benefits

### Type Safety
```typescript
// ✅ TypeScript knows the exact input/output types
const { data } = useUsers();  // data is User[] | undefined

// ❌ TypeScript will error on invalid inputs
addUserMutation.mutate({ name: 123 });  // Error: name must be string
```

### Runtime Validation
```typescript
// Input is validated with Zod before reaching the handler
const addUserSchema = z.object({
  email: z.string().email(),  // Must be valid email
  age: z.number().positive(), // Must be positive
});
```

### Automatic Cache Management
```typescript
// Queries are automatically cached
const { data } = useUsers();  // Fetches from worker

// Mutations automatically invalidate related queries
await addUserMutation.mutateAsync({...});  // useUsers refetches automatically
```

### Loading & Error States
```typescript
const { data, isLoading, error } = useUsers();
const mutation = useAddUser();

if (isLoading) return <Spinner />;
if (error) return <Error message={error.message} />;
if (mutation.isPending) return <Saving />;
```

## 🎓 Adding New Routes

1. **Define the route** in `workerRoutes.ts`:

```typescript
export const createAppRouter = (context) => {
  return createRouter({
    // ... existing routes
    
    searchUsers: query({
      input: z.object({ term: z.string() }),
      handler: async (input) => {
        return await context.db
          .select()
          .from(users)
          .where(like(users.name, `%${input.term}%`));
      },
    }),
  });
};
```

2. **Create a convenience hook** in `workerClient.ts`:

```typescript
export const useSearchUsers = (term: string) => {
  return useWorkerQuery('searchUsers', { term });
};
```

3. **Use it in your component**:

```typescript
const { data: results } = useSearchUsers("John");
```

## 🔍 Comparison with tRPC

| Feature            | tRPC          | This Implementation |
| ------------------ | ------------- | ------------------- |
| Type Safety        | ✅             | ✅                   |
| Runtime Validation | ✅ (Zod)       | ✅ (Zod)             |
| Communication      | HTTP          | Web Worker Messages |
| Client Library     | @trpc/client  | TanStack Query      |
| Server Runtime     | Node.js       | Web Worker          |
| Use Case           | Client-Server | Client-Worker       |

## 📦 Dependencies

```json
{
  "@tanstack/react-query": "^5.90.12",
  "zod": "^4.1.13"
}
```

## 🚀 Getting Started

1. Install dependencies:
```bash
pnpm install
```

2. Run the dev server:
```bash
pnpm dev
```

3. Open your browser and start building!

---

**Enjoy type-safe worker communication! 🎉**
