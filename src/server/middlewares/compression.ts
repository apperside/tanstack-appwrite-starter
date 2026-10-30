import { createMiddleware } from "@tanstack/react-start";

/**
 * Gzips server-rendered pages for clients talking to the app directly (no
 * compressing proxy in front). The implementation is loaded on the server only.
 */
export const compressionMiddleware = createMiddleware().server(
	async ({ request, next }) => {
		const result = await next();
		const { compressHtml } = await import("./compression.server");
		return compressHtml(request, result.response);
	},
);
