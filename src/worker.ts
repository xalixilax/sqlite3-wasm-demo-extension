import { PGlite } from "@electric-sql/pglite";
import { OpfsAhpFS } from "@electric-sql/pglite/opfs-ahp";
import { drizzle } from "drizzle-orm/pglite";
import { users } from "./db/schema";
import { createWorkerHandler, type WorkerRequest } from "./lib/router";
import { createAppRouter } from "./lib/workerRoutes";
import { error, log } from "./lib/workerUtils";

let isDbReady = false;
let handleRequest: ReturnType<typeof createWorkerHandler> | null = null;

(async () => {
	const fs = new OpfsAhpFS("my-pgdata");
	const client = new PGlite({ fs });
	await client.waitReady;

	const db = drizzle(client, { schema: { users } });
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
})().catch((err) => error("Init failed:", err.message));

self.addEventListener("message", async (event: MessageEvent) => {
	if (!event.data.route) return;

	const request = event.data as WorkerRequest;

	if (!isDbReady || !handleRequest) {
		postMessage({
			id: request.id,
			success: false,
			error: "Database not ready",
		});
		return;
	}

	const response = await handleRequest(request);
	postMessage(response);
});
