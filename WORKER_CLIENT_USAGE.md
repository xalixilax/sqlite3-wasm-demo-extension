# Worker Client Usage Guide

The worker client library has been refactored to support a fluent API, allowing you to call methods directly on the client for a cleaner, more intuitive syntax.

## Fluent API (Recommended)

### Using the Worker Client Directly

```typescript
import { useWorkerClient } from "./lib/workerClient";
import type { AppRouter } from "./lib/workerRoutes";

function MyComponent() {
  // Get the worker client with full type inference
  const workerClient = useWorkerClient<AppRouter>();

  // Use queries - client.routeName.query(input, options)
  const { data: users } = workerClient.getUsers.query(undefined, {
    retry: 3,
    retryDelay: 1000,
  });

  // Use mutations - client.routeName.mutate(options)
  const addUser = workerClient.addUser.mutate({
    invalidateQueries: ["getUsers"],
    onSuccess: (user) => {
      console.log("User added:", user);
    },
  });

  const updateUser = workerClient.updateUser.mutate({
    invalidateQueries: ["getUsers"],
  });

  const deleteUser = workerClient.deleteUser.mutate({
    invalidateQueries: ["getUsers"],
  });

  return (
    <div>
      <button onClick={() => addUser.mutate({ 
        name: "John", 
        email: "john@example.com", 
        age: 30 
      })}>
        Add User
      </button>
    </div>
  );
}
```

### Benefits of Fluent API

1. **Cleaner syntax**: `workerClient.updateUser.mutate()` instead of `useUpdateUser()`
2. **Better autocomplete**: Your IDE will suggest all available routes
3. **Single import**: Just import `useWorkerClient` instead of multiple hooks
4. **Flexible invalidation**: Specify `invalidateQueries` per call, not per hook

## Generic API (Advanced)

### Core Functions

All core functions accept a `TRouter` generic parameter:

- `getWorkerClient<TRouter>(workerUrl?: string)` - Get or create a worker client instance
- `useWorkerClient<TRouter>(workerUrl?: string)` - React hook to get worker client with fluent API
- `useWorkerQuery<TRouter, TRoute>(route, input, options?)` - React Query hook for queries
- `useWorkerMutation<TRouter, TRoute>(route, options?)` - React Query hook for mutations

### Options

Both `useWorkerQuery` and `useWorkerMutation` now support:
- `workerUrl?: string` - Custom worker URL (defaults to "/worker.js")
- `invalidateQueries?: string[]` - (Mutation only) Array of query keys to invalidate on success

## Usage Examples

### Using with a Custom Router

```typescript
import { z } from "zod";
import { createRouter, query, mutation } from "./lib/router";
import { useWorkerClient } from "./lib/workerClient";

// Define your custom router
export const myCustomRouter = createRouter({
  getPosts: query({
    handler: async () => {
      return [{ id: 1, title: "Hello" }];
    },
  }),
  
  createPost: mutation({
    input: z.object({
      title: z.string(),
      content: z.string(),
    }),
    handler: async (input) => {
      return { id: 1, ...input };
    },
  }),
});

export type MyCustomRouter = typeof myCustomRouter;

// Use the fluent API in your components
function MyComponent() {
  const workerClient = useWorkerClient<MyCustomRouter>("/my-worker.js");

  // Query
  const { data: posts } = workerClient.getPosts.query(undefined, {
    retry: 2,
  });

  // Mutation with automatic query invalidation
  const createPost = workerClient.createPost.mutate({
    invalidateQueries: ["getPosts"],
    onSuccess: () => {
      console.log("Post created!");
    },
  });

  return (
    <div>
      <button onClick={() => createPost.mutate({ 
        title: "New Post", 
        content: "Content here" 
      })}>
        Create Post
      </button>
    </div>
  );
}
```

### Multiple Worker Instances

You can use different routers with different worker URLs:

```typescript
function AnalyticsDashboard() {
  // Database worker
  const dbClient = useWorkerClient<AppRouter>("/db-worker.js");
  const { data: users } = dbClient.getUsers.query(undefined);

  // Analytics worker
  const analyticsClient = useWorkerClient<AnalyticsRouter>("/analytics-worker.js");
  const { data: stats } = analyticsClient.getStats.query({ period: "week" });

  return <div>{/* Your dashboard */}</div>;
}
```

## Legacy Hooks (Backward Compatible)

The existing app-specific hooks continue to work:

```typescript
import { useUsers, useAddUser, useUpdateUser, useDeleteUser } from "./lib/workerClient";

function UserManagement() {
  const { data: users } = useUsers();
  const addUser = useAddUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  // These hooks now use the fluent API internally
}
```

## Benefits

1. **Fluent API**: Clean, intuitive syntax - `workerClient.routeName.query()` or `.mutate()`
2. **Reusability**: Use the same worker client with any router
3. **Type Safety**: Full TypeScript inference for inputs and outputs
4. **Flexibility**: Support multiple workers and routers in the same app
5. **Per-call Configuration**: Specify `invalidateQueries` and other options per mutation call
6. **Backward Compatible**: Existing app-specific hooks still work

## Migration Example

**Before:**
```typescript
const addUser = useAddUser();
addUser.mutate({ name: "John", email: "john@example.com", age: 30 });
```

**After (Fluent API):**
```typescript
const workerClient = useWorkerClient<AppRouter>();
workerClient.addUser.mutate({
  invalidateQueries: ["getUsers"],
}).mutate({ name: "John", email: "john@example.com", age: 30 });
```

Or keep it simple:
```typescript
const workerClient = useWorkerClient<AppRouter>();
const addUser = workerClient.addUser.mutate({ invalidateQueries: ["getUsers"] });
addUser.mutate({ name: "John", email: "john@example.com", age: 30 });
```
