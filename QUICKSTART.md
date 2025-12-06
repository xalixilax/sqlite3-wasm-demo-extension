# Quick Start: Type-Safe Worker Routes

## 📝 TL;DR

This project now has a **tRPC-like type-safe routing system** for Web Workers with **TanStack Query** integration.

## 🎯 What You Get

✅ **Full type safety** from worker to client  
✅ **Runtime validation** with Zod  
✅ **Automatic caching & refetching** with TanStack Query  
✅ **Loading/Error states** built-in  
✅ **Simple API** similar to tRPC  

## 🚀 Quick Examples

### Fetch Data (Query)
```typescript
// In your component
const { data: users, isLoading, error } = useUsers();

if (isLoading) return <div>Loading...</div>;
if (error) return <div>Error: {error.message}</div>;
return <div>{users.map(u => u.name)}</div>;
```

### Modify Data (Mutation)
```typescript
const addUser = useAddUser();

const handleSubmit = async () => {
  await addUser.mutateAsync({
    name: "John",
    email: "john@example.com",
    age: 30
  });
  // Users list automatically refetches!
};

return (
  <button 
    onClick={handleSubmit}
    disabled={addUser.isPending}
  >
    {addUser.isPending ? 'Adding...' : 'Add User'}
  </button>
);
```

## 📁 Key Files

- **`src/lib/router.ts`** - Core router infrastructure (don't modify)
- **`src/lib/workerRoutes.ts`** - Define your routes here ⭐
- **`src/lib/workerClient.ts`** - Client hooks (add convenience hooks here)
- **`src/worker.ts`** - Worker setup
- **`src/App.tsx`** - Example usage

## ➕ Adding a New Route

### 1. Define in `workerRoutes.ts`

```typescript
import { z } from 'zod';

const searchSchema = z.object({
  term: z.string().min(1),
});

// In createAppRouter:
searchUsers: query({
  input: searchSchema,
  handler: async (input) => {
    const results = await context.db
      .select()
      .from(users)
      .where(like(users.name, `%${input.term}%`));
    return results;
  },
}),
```

### 2. Create Hook in `workerClient.ts`

```typescript
export const useSearchUsers = (term: string) => {
  return useWorkerQuery('searchUsers', { term }, {
    enabled: term.length > 0, // Only search if term exists
  });
};
```

### 3. Use in Component

```typescript
const [searchTerm, setSearchTerm] = useState('');
const { data: results } = useSearchUsers(searchTerm);

return (
  <>
    <input onChange={(e) => setSearchTerm(e.target.value)} />
    {results?.map(user => <div>{user.name}</div>)}
  </>
);
```

## 🎨 Type Safety in Action

```typescript
// ✅ TypeScript knows exact types
const { data } = useUsers();  // data: User[] | undefined

// ✅ Input validation
addUser.mutate({ 
  name: "John",
  email: "invalid-email",  // Zod will reject this!
  age: 30 
});

// ❌ TypeScript catches errors
addUser.mutate({ name: 123 });  // Error: name must be string
```

## 🔄 TanStack Query Features

### Automatic Refetching
```typescript
const { data, refetch } = useUsers();

// Manually refetch
<button onClick={() => refetch()}>Refresh</button>
```

### Optimistic Updates
```typescript
const addUser = useAddUser({
  onMutate: async (newUser) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries(['getUsers']);
    
    // Snapshot previous value
    const previous = queryClient.getQueryData(['getUsers']);
    
    // Optimistically update
    queryClient.setQueryData(['getUsers'], old => [...old, newUser]);
    
    return { previous };
  },
  onError: (err, newUser, context) => {
    // Rollback on error
    queryClient.setQueryData(['getUsers'], context.previous);
  },
});
```

### Conditional Queries
```typescript
const { data } = useWorkerQuery('getUser', { id: userId }, {
  enabled: !!userId,  // Only run when userId exists
  staleTime: 30000,   // Cache for 30 seconds
  refetchInterval: 10000,  // Refetch every 10 seconds
});
```

## 📚 Learn More

- Full guide: `WORKER_ROUTER_GUIDE.md`
- Examples: `ROUTE_EXAMPLES.example.ts`
- TanStack Query docs: https://tanstack.com/query/latest

## 🛠️ Commands

```bash
pnpm dev      # Start development server
pnpm build    # Build for production
```

---

**Happy coding with type-safe workers! 🎉**
