import {
	type UseMutationOptions,
	type UseQueryOptions,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import type {
	InferInput,
	InferOutput,
	Procedure,
	WorkerRequest,
	WorkerResponse,
} from "./router";
import type { AppRouter } from "./workerRoutes";

// Helper types for the fluent API
type RouteHelpers<TRouter extends Record<string, Procedure<any, any>>> = {
	[K in keyof TRouter]: {
		query: (
			input: InferInput<TRouter[K]>,
			options?: Omit<
				UseQueryOptions<InferOutput<TRouter[K]>, Error>,
				"queryKey" | "queryFn"
			>,
		) => ReturnType<typeof useQuery<InferOutput<TRouter[K]>, Error>>;
		mutate: (
			options?: Omit<
				UseMutationOptions<
					InferOutput<TRouter[K]>,
					Error,
					InferInput<TRouter[K]>
				>,
				"mutationFn"
			> & {
				invalidateQueries?: string[];
			},
		) => ReturnType<
			typeof useMutation<InferOutput<TRouter[K]>, Error, InferInput<TRouter[K]>>
		>;
	};
};

// Uses Procedure<any, any> to match Router interface definition
// eslint-disable-next-line @typescript-eslint/no-explicit-any
class WorkerClient<TRouter extends Record<string, Procedure<any, any>>> {
	private worker: Worker;
	private requestId = 0;
	private pendingRequests = new Map<
		string,
		{
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			resolve: (data: any) => void;
			reject: (error: Error) => void;
		}
	>();
	private queryClient?: ReturnType<typeof useQueryClient>;

	constructor(workerUrl: string) {
		this.worker = new Worker(workerUrl, { type: "module" });
		this.worker.onmessage = this.handleMessage.bind(this);
	}

	setQueryClient(queryClient: ReturnType<typeof useQueryClient>) {
		this.queryClient = queryClient;
	}

	private handleMessage(event: MessageEvent<WorkerResponse>) {
		const response = event.data;
		const pending = this.pendingRequests.get(response.id);

		if (!pending) return;

		this.pendingRequests.delete(response.id);

		if (response.success) {
			pending.resolve(response.data);
		} else {
			pending.reject(new Error(response.error || "Unknown error"));
		}
	}

	async request<TRoute extends keyof TRouter>(
		route: TRoute,
		input: InferInput<TRouter[TRoute]>,
	): Promise<InferOutput<TRouter[TRoute]>> {
		const id = `${++this.requestId}`;

		const request: WorkerRequest = {
			id,
			route: route as string,
			input,
		};

		return new Promise((resolve, reject) => {
			this.pendingRequests.set(id, { resolve, reject });
			this.worker.postMessage(request);
		});
	}

	// Fluent API builder - creates route helpers
	createRouteHelper<TRoute extends keyof TRouter>(
		route: TRoute,
	): RouteHelpers<TRouter>[TRoute] {
		return {
			query: (input, options) => {
				return useQuery<InferOutput<TRouter[TRoute]>, Error>({
					queryKey: [route as string, input],
					queryFn: () => this.request(route, input),
					...options,
				});
			},
			mutate: (options) => {
				const { invalidateQueries, ...mutationOptions } = options || {};
				if (!this.queryClient) {
					throw new Error(
						"QueryClient not set. Make sure to use useWorkerClient hook.",
					);
				}
				const queryClient = this.queryClient;

				return useMutation<
					InferOutput<TRouter[TRoute]>,
					Error,
					InferInput<TRouter[TRoute]>
				>({
					mutationFn: (input) => this.request(route, input),
					...mutationOptions,
					onSuccess: (...args) => {
						if (invalidateQueries) {
							invalidateQueries.forEach((queryKey) => {
								queryClient.invalidateQueries({ queryKey: [queryKey] });
							});
						}
						mutationOptions?.onSuccess?.(...args);
					},
				});
			},
		};
	}

	terminate() {
		this.worker.terminate();
	}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const workerClientInstances = new Map<
	string,
	WorkerClient<Record<string, Procedure<any, any>>>
>();

// Singleton proxy instances to ensure same reference per worker URL
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const proxyInstances = new Map<string, any>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getWorkerClient = <
	TRouter extends Record<string, Procedure<any, any>>,
>(
	workerUrl: string = "/worker.js",
): WorkerClient<TRouter> => {
	if (!workerClientInstances.has(workerUrl)) {
		workerClientInstances.set(workerUrl, new WorkerClient<TRouter>(workerUrl));
	}
	const instance = workerClientInstances.get(workerUrl);
	if (!instance) {
		throw new Error("Failed to create worker client instance");
	}
	return instance as WorkerClient<TRouter>;
};

// Hook to get worker client with route helpers (singleton per workerUrl)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useWorkerClient = <
	TRouter extends Record<string, Procedure<any, any>>,
>(
	workerUrl: string = "/worker.js",
): WorkerClient<TRouter> & RouteHelpers<TRouter> => {
	const queryClient = useQueryClient();

	// Return existing proxy instance if available
	if (proxyInstances.has(workerUrl)) {
		const existingProxy = proxyInstances.get(workerUrl);
		if (existingProxy) {
			// Update query client in case it changed
			(existingProxy as WorkerClient<TRouter>).setQueryClient(queryClient);
			return existingProxy as WorkerClient<TRouter> & RouteHelpers<TRouter>;
		}
	}

	// Create new proxy instance
	const client = getWorkerClient<TRouter>(workerUrl);
	client.setQueryClient(queryClient);

	const proxy = new Proxy(client, {
		get(target, prop) {
			// If the property exists on the client, return it
			if (prop in target) {
				return target[prop as keyof typeof target];
			}
			// Otherwise, create a route helper for this route
			return target.createRouteHelper(prop as keyof TRouter);
		},
	}) as WorkerClient<TRouter> & RouteHelpers<TRouter>;

	// Cache the proxy instance
	proxyInstances.set(workerUrl, proxy);

	return proxy;
};

// Uses Procedure<any, any> to match Router interface definition
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useWorkerQuery = <
	TRouter extends Record<string, Procedure<any, any>>,
	TRoute extends keyof TRouter,
>(
	route: TRoute,
	input: InferInput<TRouter[TRoute]>,
	options?: Omit<
		UseQueryOptions<InferOutput<TRouter[TRoute]>, Error>,
		"queryKey" | "queryFn"
	> & {
		workerUrl?: string;
	},
) => {
	const { workerUrl = "/worker.js", ...queryOptions } = options || {};
	const client = useWorkerClient<TRouter>(workerUrl);

	return useQuery<InferOutput<TRouter[TRoute]>, Error>({
		queryKey: [route as string, input],
		queryFn: () => client.request(route, input),
		...queryOptions,
	});
};

// Uses Procedure<any, any> to match Router interface definition
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useWorkerMutation = <
	TRouter extends Record<string, Procedure<any, any>>,
	TRoute extends keyof TRouter,
>(
	route: TRoute,
	options?: Omit<
		UseMutationOptions<
			InferOutput<TRouter[TRoute]>,
			Error,
			InferInput<TRouter[TRoute]>
		>,
		"mutationFn"
	> & {
		workerUrl?: string;
		invalidateQueries?: string[];
	},
) => {
	const {
		workerUrl = "/worker.js",
		invalidateQueries,
		...mutationOptions
	} = options || {};
	const client = useWorkerClient<TRouter>(workerUrl);
	const queryClient = useQueryClient();

	return useMutation<
		InferOutput<TRouter[TRoute]>,
		Error,
		InferInput<TRouter[TRoute]>
	>({
		mutationFn: (input) => client.request(route, input),
		...mutationOptions,
		onSuccess: (...args) => {
			if (invalidateQueries) {
				invalidateQueries.forEach((queryKey) => {
					queryClient.invalidateQueries({ queryKey: [queryKey] });
				});
			}
			mutationOptions?.onSuccess?.(...args);
		},
	});
};



// App-specific hooks using the AppRouter
export const useUsers = (
	options?: Omit<
		UseQueryOptions<InferOutput<AppRouter["getUsers"]>, Error>,
		"queryKey" | "queryFn"
	>,
) => {
	return useWorkerQuery<AppRouter, "getUsers">("getUsers", undefined, {
		retry: 3,
		retryDelay: 1000,
		...options,
	});
};

// Legacy app-specific hooks (kept for backward compatibility)
export const useAddUser = (
	options?: Omit<
		UseMutationOptions<
			InferOutput<AppRouter["addUser"]>,
			Error,
			InferInput<AppRouter["addUser"]>
		>,
		"mutationFn"
	>,
) => {
	const client = useWorkerClient<AppRouter>();
	return client.addUser.mutate({
		...options,
		invalidateQueries: ["getUsers"],
	});
};

export const useUpdateUser = (
	options?: Omit<
		UseMutationOptions<
			InferOutput<AppRouter["updateUser"]>,
			Error,
			InferInput<AppRouter["updateUser"]>
		>,
		"mutationFn"
	>,
) => {
	const client = useWorkerClient<AppRouter>();
	return client.updateUser.mutate({
		...options,
		invalidateQueries: ["getUsers"],
	});
};

export const useDeleteUser = (
	options?: Omit<
		UseMutationOptions<
			InferOutput<AppRouter["deleteUser"]>,
			Error,
			InferInput<AppRouter["deleteUser"]>
		>,
		"mutationFn"
	>,
) => {
	const client = useWorkerClient<AppRouter>();
	return client.deleteUser.mutate({
		...options,
		invalidateQueries: ["getUsers"],
	});
};
