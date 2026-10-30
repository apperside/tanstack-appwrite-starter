import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "#/server/middlewares/auth-middleware";

/* v8 ignore start -- thin createServerFn wiring: logic is tested via realtime.handlers.server.ts; delegation only — no logic between these markers */
/** Consumed by `withBrowserClient`. */
export const issueBrowserJwt = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.handler(async ({ context }) =>
		(await import("./realtime.handlers.server")).issueBrowserJwtHandler({
			context,
		}),
	);
/* v8 ignore stop */
