// biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control characters is the point.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

function isSafePath(path: string): boolean {
	return (
		path.startsWith("/") &&
		path[1] !== "/" &&
		path[1] !== "\\" &&
		!CONTROL_CHARS.test(path)
	);
}

/**
 * Returns `value` when it is a same-origin path, else `/`. Blocks open redirects
 * (`//host`, `/\host`, absolute URLs), also when percent-encoded.
 */
export function sanitizeRedirect(value: unknown): string {
	if (typeof value !== "string" || !isSafePath(value)) return "/";
	let decoded: string;
	try {
		decoded = decodeURIComponent(value);
	} catch {
		return "/";
	}
	return isSafePath(decoded) ? value : "/";
}
