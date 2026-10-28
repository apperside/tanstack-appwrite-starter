import { describe, expect, it } from "vitest";
import { sanitizeRedirect } from "./redirect";

describe("sanitizeRedirect", () => {
	it("keeps same-origin paths", () => {
		expect(sanitizeRedirect("/settings/security?tab=1")).toBe(
			"/settings/security?tab=1",
		);
		expect(sanitizeRedirect("/a%20b")).toBe("/a%20b");
	});

	it("keeps a double-encoded path: it is decoded once, so it stays a literal path segment and never becomes //", () => {
		expect(sanitizeRedirect("/%252F%252Fevil.com")).toBe("/%252F%252Fevil.com");
	});

	it.each([
		"//evil.com",
		"/\\evil.com",
		"https://evil.com",
		"%2F%2Fevil.com",
		"%2F%5Cevil.com",
		"/%2Fevil.com",
		"/%5Cevil.com",
		"/\t/evil.com",
		"javascript:alert(1)",
		"/ok%",
		"/a\nb",
		"/a%0Ab",
		"",
		undefined,
		42,
	])("falls back to / for %j", (value) => {
		expect(sanitizeRedirect(value)).toBe("/");
	});
});
