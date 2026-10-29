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
				"src/adapters/appwrite/generated/**",
				"src/test/**",
				"**/*.test.*",
				"src/routes/**",
				// Vendored shadcn kit (Task 23): tested through the screens that use it.
				"src/components/ui/**",
			],
			// Per-glob thresholds; globs matching no files are skipped by Vitest.
			thresholds: {
				"src/lib/**": { lines: 90, branches: 90 },
				"src/server/**": { lines: 90, branches: 90 },
				"src/core/**": { lines: 90, branches: 90 },
				"src/adapters/**": { lines: 90, branches: 85 },
				"src/features/**/*.functions.ts": { lines: 90, branches: 90 },
				"src/features/**/*.handlers.server.ts": { lines: 90, branches: 90 },
				"src/components/**": { lines: 80, branches: 80 },
				"src/features/**/components/**": { lines: 80, branches: 80 },
			},
		},
	},
});
