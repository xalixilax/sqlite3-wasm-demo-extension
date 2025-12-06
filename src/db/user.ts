import { PGlite } from "@electric-sql/pglite";
import { OpfsAhpFS } from "@electric-sql/pglite/opfs-ahp";
import { drizzle } from "drizzle-orm/pglite";
import { users } from "./schema";

let db: ReturnType<typeof drizzle<{ users: typeof users }>>;

async function initDb() {
	const fs = new OpfsAhpFS("my-pgdata");
	const client = new PGlite({ fs });
	await client.waitReady;
	db = drizzle(client, { schema: { users } });
	return db;
}

export { db, initDb };
