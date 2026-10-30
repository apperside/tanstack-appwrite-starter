import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const setupFiles = ["src/test/setup.ts"];

export default defineConfig({
	plugins: [react()],
	resolve: { tsconfigPaths: true },
	test: {
		// Fake public values so tests never depend on a local .env.local.
		env: {
			VITE_APPWRITE_ENDPOINT: "http://appwrite.test/v1",
			VITE_APPWRITE_PROJECT_ID: "test-project",
			VITE_APPWRITE_DATABASE_ID: "test-db",
		},
		projects: [
			{
				extends: true,
				test: {
					name: "node",
					environment: "node",
					include: ["src/**/*.test.ts"],
					// PGlite's WASM start-up plus migrations can outlast the default 10s.
					hookTimeout: 30_000,
					setupFiles,
				},
			},
			{
				extends: true,
				test: {
					name: "jsdom",
					environment: "jsdom",
					include: ["src/**/*.test.tsx"],
					setupFiles,
				},
			},
		],
		coverage: {
			provider: "v8",
			include: ["src/**/*.{ts,tsx}"],
			exclude: [
				"src/routeTree.gen.ts",
				"src/server/adapters/appwrite/generated/**",
				"src/test/**",
				"**/*.test.*",
				"src/routes/**",
				// Needs a real server: checked by the manual smoke test.
				"src/server/adapters/postgres/db.server.ts",
				// Needs a real server: checked by the manual smoke test.
				"src/server/adapters/postgres/migrate.server.ts",
				// Vendored shadcn kit (Task 23): tested through the screens that use it.
				"src/client/components/ui/**",
			],
			// Per-glob thresholds; globs matching no files are skipped by Vitest.
			thresholds: {
				"src/lib/**": { lines: 90, branches: 90 },
				"src/core/**": { lines: 90, branches: 90 },
				// The API (functions and handlers), context, middlewares and cookies.
				"src/server/{api,context,cookies,functions,middlewares,utils}/**": {
					lines: 90,
					branches: 90,
				},
				"src/server/*.ts": { lines: 90, branches: 90 },
				"src/server/adapters/**": { lines: 90, branches: 85 },
				"src/client/components/**": { lines: 80, branches: 80 },
				"src/client/features/**/components/**": { lines: 80, branches: 80 },
			},
		},
	},
});
