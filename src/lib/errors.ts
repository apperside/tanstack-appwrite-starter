const APP_ERROR_CODES = [
	"INVALID_CREDENTIALS",
	"EMAIL_TAKEN",
	"WEAK_PASSWORD",
	"INVALID_TOKEN",
	"UNAUTHENTICATED",
	"FORBIDDEN",
	"RATE_LIMITED",
	"NOT_FOUND",
	"NETWORK",
	"UNKNOWN",
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

function isAppErrorCode(value: string): value is AppErrorCode {
	return (APP_ERROR_CODES as readonly string[]).includes(value);
}

/**
 * The message IS the code: server-function serialization keeps only `message`,
 * so the client can rebuild the code with `toAppError`.
 */
export class AppError extends Error {
	override name = "AppError";

	/** `cause`: the original error (an adapter's vendor error), for logs only. */
	constructor(
		readonly code: AppErrorCode,
		options?: { cause?: unknown },
	) {
		super(code, options);
	}

	get i18nKey(): `errors:${AppErrorCode}` {
		return `errors:${this.code}`;
	}
}

/** Messages of a failed `fetch` per engine: Chrome, Firefox, Safari, Node (undici). */
const FETCH_FAILURE_MESSAGES = [
	"Failed to fetch",
	"NetworkError when attempting to fetch resource.",
	"Load failed",
	"fetch failed",
];

function isFetchFailure(error: unknown): boolean {
	return (
		error instanceof TypeError && FETCH_FAILURE_MESSAGES.includes(error.message)
	);
}

/**
 * Normalizes anything thrown (an adapter's `AppError`, a failed fetch, a
 * serialized `AppError`) into an `AppError`. Adapters translate their vendor's
 * errors themselves, so anything else is `UNKNOWN`.
 */
export function toAppError(error: unknown): AppError {
	if (error instanceof AppError) return error;
	if (isFetchFailure(error)) return new AppError("NETWORK");
	if (error instanceof Error && isAppErrorCode(error.message)) {
		return new AppError(error.message);
	}
	return new AppError("UNKNOWN");
}
