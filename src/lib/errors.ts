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

	constructor(readonly code: AppErrorCode) {
		super(code);
	}

	get i18nKey(): `errors:${AppErrorCode}` {
		return `errors:${this.code}`;
	}
}

// Type strings verified against appwrite/appwrite src/Appwrite/Extend/Exception.php (1.8.1 and main).
const APPWRITE_TYPE_TO_CODE: Record<string, AppErrorCode> = {
	user_invalid_credentials: "INVALID_CREDENTIALS",
	user_password_mismatch: "INVALID_CREDENTIALS",
	user_already_exists: "EMAIL_TAKEN",
	user_email_already_exists: "EMAIL_TAKEN",
	password_recently_used: "WEAK_PASSWORD",
	password_personal_data: "WEAK_PASSWORD",
	password_pwned: "WEAK_PASSWORD",
	user_invalid_token: "INVALID_TOKEN",
	user_unauthorized: "UNAUTHENTICATED",
	general_unauthorized_scope: "UNAUTHENTICATED",
	user_session_not_found: "UNAUTHENTICATED",
	user_jwt_invalid: "UNAUTHENTICATED",
	general_rate_limit_exceeded: "RATE_LIMITED",
	row_not_found: "NOT_FOUND",
	document_not_found: "NOT_FOUND",
	user_not_found: "NOT_FOUND",
};

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
 * Structural match so both the browser and node SDK exceptions are recognized
 * without importing either SDK here.
 */
function isAppwriteException(
	error: unknown,
): error is Error & { type: string; code: number } {
	return (
		error instanceof Error &&
		error.name === "AppwriteException" &&
		typeof (error as { type?: unknown }).type === "string" &&
		typeof (error as { code?: unknown }).code === "number"
	);
}

/** Normalizes anything thrown (Appwrite, fetch, a serialized AppError) into an `AppError`. */
export function toAppError(error: unknown): AppError {
	if (error instanceof AppError) return error;
	if (isAppwriteException(error)) {
		const code = Object.hasOwn(APPWRITE_TYPE_TO_CODE, error.type)
			? APPWRITE_TYPE_TO_CODE[error.type]
			: undefined;
		return new AppError(code ?? "UNKNOWN");
	}
	if (isFetchFailure(error)) return new AppError("NETWORK");
	if (error instanceof Error && isAppErrorCode(error.message)) {
		return new AppError(error.message);
	}
	return new AppError("UNKNOWN");
}
