import { AppError, type AppErrorCode } from "#/lib/errors";

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

/**
 * An Appwrite exception as an `AppError` (an unlisted type is `UNKNOWN`, with
 * the exception as its `cause`); anything else unchanged.
 */
export function fromAppwriteError(error: unknown): unknown {
	if (!isAppwriteException(error)) return error;
	const code = Object.hasOwn(APPWRITE_TYPE_TO_CODE, error.type)
		? APPWRITE_TYPE_TO_CODE[error.type]
		: undefined;
	return new AppError(code ?? "UNKNOWN", { cause: error });
}

/**
 * `methods` with every rejection passed through `fromAppwriteError`, so the
 * adapter keeps its promise to reject only with `AppError`s. Name the port as
 * `T` (`translateErrors<SessionAuth>({...})`) to type the methods from it.
 */
export function translateErrors<T extends object>(methods: T): T {
	return Object.fromEntries(
		Object.entries(methods).map(([name, method]) => [
			name,
			(...args: unknown[]) =>
				(method as (...args: unknown[]) => Promise<unknown>)(...args).catch(
					(error: unknown) => {
						throw fromAppwriteError(error);
					},
				),
		]),
	) as T;
}
