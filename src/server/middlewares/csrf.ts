import { createCsrfMiddleware } from "@tanstack/react-start";
import { serverEnv } from "#/config/env";

/**
 * Refuses server-function calls from another origin. Start applies its own
 * default only when there is no `src/start.ts`, so it is registered there.
 * `Sec-Fetch-Site` must be `same-origin`; without it (older browsers),
 * `Origin` or `Referer` must be `APP_URL`'s origin, not the request URL's,
 * which a TLS-terminating proxy may rewrite.
 */
export const csrfMiddleware = createCsrfMiddleware({
	filter: (ctx) => ctx.handlerType === "serverFn",
	origin: (origin) => origin === new URL(serverEnv().APP_URL).origin,
});
