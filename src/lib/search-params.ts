import { defaultParseSearch } from "@tanstack/react-router";

/**
 * The router's default search parsing (values read as JSON), except that a
 * value which would not survive the round trip stays the string it was:
 * `?userId=65e12` from an email link is the id "65e12", not 65000000000000.
 * Router-built URLs are unaffected (they quote such strings).
 */
export function parseSearch(searchStr: string): Record<string, unknown> {
	const parsed: Record<string, unknown> = defaultParseSearch(searchStr);
	const raw = new URLSearchParams(searchStr);
	for (const [key, value] of Object.entries(parsed)) {
		const original = raw.get(key);
		const primitive = typeof value === "number" || typeof value === "boolean";
		if (primitive && original !== null && String(value) !== original) {
			parsed[key] = original;
		}
	}
	return parsed;
}
