import { defineConfig } from "drizzle-kit";

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/server/adapters/postgres/schema.ts",
	out: "./src/server/adapters/postgres/migrations",
	dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
