/**
 * EXAMPLE: Adding New Routes to the Worker Router
 *
 * This file demonstrates how to add new routes to your worker router system.
 * Follow these examples to extend your API with new functionality.
 */

import { z } from "zod";
import { createRouter, mutation, query } from "./lib/router";

// ========================================
// Example 1: Simple Query (No Input)
// ========================================

export const simpleQueryExample = query({
	// No input schema needed
	handler: async (): Promise<string> => {
		return "Hello from worker!";
	},
});

// Usage in React:
// const { data } = useWorkerQuery('greeting', undefined);

// ========================================
// Example 2: Query with Input Validation
// ========================================

const searchSchema = z.object({
	term: z.string().min(1),
	limit: z.number().int().positive().optional().default(10),
});

export const searchQueryExample = query({
	input: searchSchema,
	handler: async (input): Promise<any[]> => {
		// input is type-safe: { term: string; limit?: number }
		// Zod has already validated the input

		// Your search logic here
		const results = []; // await db.search(input.term, input.limit)
		return results;
	},
});

// Usage in React:
// const { data } = useWorkerQuery('search', { term: 'john', limit: 5 });

// ========================================
// Example 3: Mutation with Complex Input
// ========================================

const updateProfileSchema = z.object({
	userId: z.number().int().positive(),
	data: z.object({
		name: z.string().optional(),
		email: z.string().email().optional(),
		age: z.number().int().min(0).max(150).optional(),
		preferences: z
			.object({
				theme: z.enum(["light", "dark"]).optional(),
				language: z.string().optional(),
			})
			.optional(),
	}),
});

export const updateProfileMutation = mutation({
	input: updateProfileSchema,
	handler: async (input) => {
		// input is fully typed
		const { userId, data } = input;

		// Your update logic here
		// const updated = await db.users.update(userId, data);

		return { success: true, userId };
	},
});

// Usage in React:
// const mutation = useWorkerMutation('updateProfile');
// await mutation.mutateAsync({
//   userId: 1,
//   data: { name: 'John', preferences: { theme: 'dark' } }
// });

// ========================================
// Example 4: Advanced Validation
// ========================================

const advancedSchema = z.object({
	email: z
		.string()
		.email("Must be a valid email")
		.refine((email) => email.endsWith("@company.com"), {
			message: "Must be a company email",
		}),
	password: z
		.string()
		.min(8, "Password must be at least 8 characters")
		.regex(/[A-Z]/, "Must contain uppercase letter")
		.regex(/[a-z]/, "Must contain lowercase letter")
		.regex(/[0-9]/, "Must contain number"),
	tags: z.array(z.string()).min(1).max(5),
	metadata: z.record(z.string(), z.any()),
});

export const advancedMutation = mutation({
	input: advancedSchema,
	handler: async (input) => {
		// All validation rules have been checked
		return { success: true };
	},
});

// ========================================
// Example 5: Async Validation & Custom Logic
// ========================================

const emailCheckSchema = z.string().email();

export const checkEmailAvailability = query({
	input: emailCheckSchema,
	handler: async (email): Promise<{ available: boolean }> => {
		// You can do async checks in the handler
		// const existingUser = await db.users.findByEmail(email);
		// return { available: !existingUser };

		return { available: true };
	},
});

// ========================================
// Example 6: Handling Errors
// ========================================

export const errorHandlingExample = mutation({
	input: z.object({ id: z.number() }),
	handler: async (input) => {
		// Errors thrown here are automatically caught and sent to the client
		const item = null; // await db.find(input.id);

		if (!item) {
			throw new Error("Item not found");
		}

		return item;
	},
});

// Usage in React:
// const mutation = useWorkerMutation('deleteItem', {
//   onError: (error) => {
//     alert(error.message); // "Item not found"
//   }
// });

// ========================================
// Example 7: Router with Context
// ========================================

export const createExampleRouter = (context: {
	db: any;
	auth: any;
	log: (...args: string[]) => void;
}) => {
	return createRouter({
		getUsers: query({
			handler: async () => {
				context.log("Fetching users...");
				const users = await context.db.users.findMany();
				return users;
			},
		}),

		getCurrentUser: query({
			handler: async () => {
				const userId = context.auth.currentUserId;
				const user = await context.db.users.findById(userId);
				return user;
			},
		}),

		createPost: mutation({
			input: z.object({
				title: z.string(),
				content: z.string(),
			}),
			handler: async (input) => {
				const userId = context.auth.currentUserId;
				const post = await context.db.posts.create({
					...input,
					authorId: userId,
				});
				context.log(`Post created: ${post.id}`);
				return post;
			},
		}),
	});
};

// ========================================
// Example 8: Creating Convenience Hooks
// ========================================

// In your workerClient.ts, add:

/*
export const useSearchUsers = (term: string, limit?: number) => {
  return useWorkerQuery('search', { term, limit }, {
    enabled: term.length > 0,  // Only run when term is provided
    staleTime: 30000,          // Cache for 30 seconds
  });
};

export const useUpdateProfile = () => {
  return useWorkerMutation('updateProfile', {
    onSuccess: () => {
      console.log('Profile updated!');
    },
    onError: (error) => {
      console.error('Failed to update profile:', error);
    },
  });
};

export const useCheckEmail = (email: string) => {
  return useWorkerQuery('checkEmailAvailability', email, {
    enabled: email.length > 0 && email.includes('@'),
    refetchInterval: false,  // Don't auto-refetch
  });
};
*/

// ========================================
// Best Practices
// ========================================

/*
1. Always validate inputs with Zod schemas
2. Use descriptive names for routes
3. Return consistent types from handlers
4. Throw errors for exceptional cases
5. Use 'query' for reads, 'mutation' for writes
6. Create convenience hooks for common operations
7. Document expected inputs and outputs
8. Keep handlers focused and testable

Type Safety Tips:
- Let TypeScript infer types from your handlers
- Export router type: export type AppRouter = ReturnType<typeof createRouter>
- Use the exported types in your client hooks

Performance:
- Configure staleTime in TanStack Query to reduce refetches
- Use enabled option to conditionally run queries
- Consider pagination for large datasets
*/

export default {
	message:
		"This is an example file showing various patterns. Import what you need!",
};
