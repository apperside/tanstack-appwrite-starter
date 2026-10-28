import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const setupFiles = ["src/test/setup.ts"];

export default defineConfig({
	plugins: [react()],
	resolve: { tsconfigPaths: true },
	test: {
		// Foundations has no tests yet; remove once real tests land.
		passWithNoTests: true,
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
				"src/lib/appwrite/generated/**",
				"src/test/**",
				"**/*.test.*",
				"src/routes/**",
			],
			// Per-glob thresholds; globs matching no files are skipped by Vitest.
			thresholds: {
				"src/lib/**": { lines: 90, branches: 90 },
				"src/server/**": { lines: 90, branches: 90 },
				"src/features/**/*.functions.ts": { lines: 90, branches: 90 },
				"src/components/**": { lines: 80, branches: 80 },
				"src/features/**/components/**": { lines: 80, branches: 80 },
			},
		},
	},
});
