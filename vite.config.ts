import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

/**
 * The runtime every page needs, in one long-cached chunk. With the form kit
 * below, a public page loads 10 scripts instead of 27: fewer requests compete
 * with first paint (6 per origin over HTTP/1.1; ≈ −450 ms simulated LCP).
 */
const FRAMEWORK =
	/[\\/]node_modules[\\/](react|react-dom|scheduler|use-sync-external-store|@tanstack[\\/](react-router|router-core|history|store|react-store|query-core|react-query|start-client-core|react-start-client|router-ssr-query-core|react-router-ssr-query)|seroval|seroval-plugins|cookie-es|i18next|react-i18next)[\\/]/;

/** The form kit: the public pages and settings all render forms. */
const FORMS =
	/[\\/]node_modules[\\/](@tanstack[\\/](react-form|form-core|pacer-lite|devtools-event-client)|@radix-ui[\\/](react-label|react-primitive))[\\/]|[\\/]src[\\/]components[\\/](form[\\/]|ui[\\/](input|label|alert)\.tsx)/;

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	environments: {
		client: {
			build: {
				rolldownOptions: {
					output: {
						codeSplitting: {
							groups: [
								{ name: "framework", test: FRAMEWORK },
								{ name: "forms", test: FORMS },
							],
						},
					},
				},
			},
		},
	},
	plugins: [
		devtools(),
		nitro({
			preset: "node-server",
			// Static assets ship pre-compressed (.gz/.br), served by Content-Encoding.
			compressPublicAssets: { gzip: true, brotli: true },
		}),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
	],
});

export default config;
