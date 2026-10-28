import { toAppError } from "#/lib/errors";

/**
 * A handler's outcome as the client receives it: `authMiddleware` normalizes
 * every failure with `toAppError`, so handlers throw raw SDK errors.
 */
export function throughMiddleware<T>(outcome: Promise<T>): Promise<T> {
	return outcome.catch((error: unknown) => {
		throw toAppError(error);
	});
}
