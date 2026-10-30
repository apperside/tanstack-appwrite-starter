import { AppError, type AppErrorCode } from "#/lib/errors";

const UNIQUE_VIOLATION = "23505";
const CONNECTION_CODES = new Set([
	"ECONNREFUSED",
	"ECONNRESET",
	"ETIMEDOUT",
	"57P01",
	"57P03",
]);
const MAX_DEPTH = 3;

/** The first string `code` on `error` or its `cause` chain, if any. */
function findCode(error: unknown): string | undefined {
	for (let depth = 0; depth < MAX_DEPTH; depth++) {
		if (typeof error !== "object" || error === null) return undefined;
		const { code, cause } = error as { code?: unknown; cause?: unknown };
		if (typeof code === "string") return code;
		error = cause;
	}
	return undefined;
}

function toAppErrorCode(pgCode: string | undefined): AppErrorCode {
	// The only unique index user input can violate is the users' email index.
	if (pgCode === UNIQUE_VIOLATION) return "EMAIL_TAKEN";
	if (pgCode && (CONNECTION_CODES.has(pgCode) || pgCode.startsWith("08"))) {
		return "NETWORK";
	}
	return "UNKNOWN";
}

/**
 * A Postgres or driver error as an `AppError` (an unlisted code is `UNKNOWN`,
 * with the error as its `cause`); an `AppError` unchanged.
 */
export function fromPostgresError(error: unknown): unknown {
	if (error instanceof AppError) return error;
	return new AppError(toAppErrorCode(findCode(error)), { cause: error });
}

/**
 * `methods` with every rejection passed through `fromPostgresError`, so the
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
						throw fromPostgresError(error);
					},
				),
		]),
	) as T;
}
