import { isNotFound, isRedirect } from "@tanstack/react-router";
import { createMiddleware } from "@tanstack/react-start";
import { toAppError } from "#/lib/errors";

/**
 * What a failed server function sends the client: router control flow
 * (redirect, notFound) as is, anything else as a stable `AppError` (spec §5.4).
 * An error nothing maps (`UNKNOWN`) is a bug or an outage, so its original is
 * logged here, the one place every server function passes through.
 */
function normalizeError(
	error: unknown,
	serverFn: { name: string; filename: string } | undefined,
): unknown {
	if (isRedirect(error) || isNotFound(error)) return error;
	const appError = toAppError(error);
	if (appError.code === "UNKNOWN") {
		const where = serverFn
			? `${serverFn.name} (${serverFn.filename})`
			: "a server function";
		// An adapter's translated error keeps the vendor's original as its cause.
		console.error(`Unexpected error in ${where}`, appError.cause ?? error);
	}
	return appError;
}

/**
 * Puts a lazy `ServerContext` on every server function that uses it, and
 * normalizes its failures (so handlers just throw).
 * The server-only module is imported inside the callback so the client bundle,
 * which still references this middleware object, never pulls it in.
 */
export const authMiddleware = createMiddleware({ type: "function" }).server(
	async ({ next, serverFnMeta }) => {
		try {
			const { buildRequestContext } = await import("./auth-middleware.server");
			return await next({ context: await buildRequestContext() });
		} catch (error) {
			throw normalizeError(error, serverFnMeta);
		}
	},
);
