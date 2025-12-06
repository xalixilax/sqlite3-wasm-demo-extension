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
	WorkerRequest,
	WorkerResponse,
} from "./router";
import type { AppRouter } from "./workerRoutes";

class WorkerClient {
	private worker: Worker;
	private requestId = 0;
	private pendingRequests = new Map<
		string,
		{
			resolve: (data: any) => void;
			reject: (error: Error) => void;
		}
	>();

	constructor(workerUrl: string) {
		this.worker = new Worker(workerUrl, { type: "module" });
		this.worker.onmessage = this.handleMessage.bind(this);
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

	async request<TRoute extends keyof AppRouter>(
		route: TRoute,
		input: InferInput<AppRouter[TRoute]>,
	): Promise<InferOutput<AppRouter[TRoute]>> {
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

	terminate() {
		this.worker.terminate();
	}
}

let workerClientInstance: WorkerClient | null = null;

export const getWorkerClient = (
	workerUrl: string = "/worker.js",
): WorkerClient => {
	if (!workerClientInstance) {
		workerClientInstance = new WorkerClient(workerUrl);
	}
	return workerClientInstance;
};

export const useWorkerClient = (workerUrl: string = "/worker.js") => {
	return getWorkerClient(workerUrl);
};

export const useWorkerQuery = <TRoute extends keyof AppRouter>(
	route: TRoute,
	input: InferInput<AppRouter[TRoute]>,
	options?: Omit<
		UseQueryOptions<InferOutput<AppRouter[TRoute]>, Error>,
		"queryKey" | "queryFn"
	>,
) => {
	const client = useWorkerClient();

	return useQuery<InferOutput<AppRouter[TRoute]>, Error>({
		queryKey: [route, input],
		queryFn: () => client.request(route, input),
		...options,
	});
};

export const useWorkerMutation = <TRoute extends keyof AppRouter>(
	route: TRoute,
	options?: Omit<
		UseMutationOptions<
			InferOutput<AppRouter[TRoute]>,
			Error,
			InferInput<AppRouter[TRoute]>
		>,
		"mutationFn"
	>,
) => {
	const client = useWorkerClient();
	const queryClient = useQueryClient();

	return useMutation<
		InferOutput<AppRouter[TRoute]>,
		Error,
		InferInput<AppRouter[TRoute]>
	>({
		mutationFn: (input) => client.request(route, input),
		...options,
		onSuccess: (...args) => {
			queryClient.invalidateQueries({ queryKey: ["getUsers"] });
			options?.onSuccess?.(...args);
		},
	});
};

export const useUsers = (
	options?: Omit<
		UseQueryOptions<InferOutput<AppRouter["getUsers"]>, Error>,
		"queryKey" | "queryFn"
	>,
) => {
	return useWorkerQuery("getUsers", undefined, {
		retry: 3,
		retryDelay: 1000,
		...options,
	});
};

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
	return useWorkerMutation("addUser", options);
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
	return useWorkerMutation("updateUser", options);
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
	return useWorkerMutation("deleteUser", options);
};
