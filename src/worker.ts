import { users } from "./db/schema";
import { createWorkerHandler, type WorkerRequest } from "./lib/router";
import { createAppRouter } from "./routers/userRouters";
import { error, log } from "./lib/workerUtils";
import { db, initDb } from "./db/user";

let isDbReady = false;
let handleRequest: ReturnType<typeof createWorkerHandler> | null = null;
const requestQueue: WorkerRequest[] = [];

(async () => {
	await initDb();
	const router = createAppRouter({ db, log, error });
	handleRequest = createWorkerHandler(router);

	await db.execute(`
		CREATE TABLE IF NOT EXISTS users (
			id SERIAL PRIMARY KEY,
			name TEXT NOT NULL,
			email TEXT NOT NULL,
			age INTEGER NOT NULL
		);
	`);

	const allUsers = await db.select().from(users);
	if (allUsers.length === 0) {
		await db.insert(users).values({
			name: "John Doe",
			email: "john@example.com",
			age: 30,
		});
	}

	isDbReady = true;
	log("Database ready");

	// Process queued requests
	while (requestQueue.length > 0) {
		const queuedRequest = requestQueue.shift();
		if (queuedRequest) {
			const response = await handleRequest(queuedRequest);
			postMessage(response);
		}
	}
})().catch((err) => error("Init failed:", err.message));

self.addEventListener("message", async (event: MessageEvent) => {
	if (!event.data.route) return;

	const request = event.data as WorkerRequest;

	if (!isDbReady || !handleRequest) {
		requestQueue.push(request);
		log(`Request queued: ${request.route}`);
		return;
	}

	const response = await handleRequest(request);
	postMessage(response);
});
