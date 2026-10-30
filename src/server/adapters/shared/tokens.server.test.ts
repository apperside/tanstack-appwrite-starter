import { describe, expect, it } from "vitest";
import { hashToken, linkTo, newToken } from "./tokens.server";

describe("tokens", () => {
	it("makes 256-bit url-safe tokens", () => {
		expect(newToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(newToken()).not.toBe(newToken());
	});

	it("hashes tokens deterministically, never echoing them", () => {
		const token = newToken();
		expect(hashToken(token)).toBe(hashToken(token));
		expect(hashToken(token)).not.toBe(token);
		expect(hashToken(token)).toMatch(/^[A-Za-z0-9_-]{43}$/);
	});

	it("appends params, keeping the path and existing query", () => {
		expect(
			linkTo("https://app.test/base/reset-password?keep=1", { token: "abc" }),
		).toBe("https://app.test/base/reset-password?keep=1&token=abc");
	});
});
