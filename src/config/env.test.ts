import { describe, expect, it } from "vitest";
import { parsePublicEnv, parseServerEnv } from "./env";

const validPublic = {};

describe("parsePublicEnv", () => {
	it("parses valid values", () => {
		expect(parsePublicEnv(validPublic)).toEqual({
			REQUIRE_EMAIL_VERIFICATION: false,
		});
	});

	it.each([
		["true", true],
		["false", false],
		[undefined, false],
		["", false],
	])("coerces REQUIRE_EMAIL_VERIFICATION %s", (value, expected) => {
		const result = parsePublicEnv({
			...validPublic,
			VITE_REQUIRE_EMAIL_VERIFICATION: value,
		});
		expect(result.REQUIRE_EMAIL_VERIFICATION).toBe(expected);
	});
});

describe("parsePublicEnv errors", () => {
	it("rejects an unrecognised flag value, naming the variable", () => {
		expect(() =>
			parsePublicEnv({
				...validPublic,
				VITE_REQUIRE_EMAIL_VERIFICATION: "maybe",
			}),
		).toThrow(/VITE_REQUIRE_EMAIL_VERIFICATION/);
	});
});

describe("parseServerEnv", () => {
	it("parses valid values", () => {
		expect(
			parseServerEnv({
				APP_URL: "http://localhost:3000",
			}),
		).toEqual({
			BACKEND: "appwrite",
			APP_URL: "http://localhost:3000",
			TRUSTED_PROXY_HOPS: 0,
		});
	});

	it("rejects a non-URL APP_URL, naming the variable", () => {
		expect(() => parseServerEnv({ APP_URL: "not a url" })).toThrow(/APP_URL/);
	});

	it.each([
		["memory", "memory"],
		["postgres", "postgres"],
		["appwrite", "appwrite"],
		["", "appwrite"],
	])("parses BACKEND %j as %j", (raw, expected) => {
		expect(
			parseServerEnv({ APP_URL: "http://localhost:3000", BACKEND: raw })
				.BACKEND,
		).toBe(expected);
	});

	it("rejects an unknown BACKEND, naming the variable", () => {
		expect(() =>
			parseServerEnv({ APP_URL: "http://localhost:3000", BACKEND: "mongo" }),
		).toThrow(/BACKEND/);
	});

	describe("TRUSTED_PROXY_HOPS", () => {
		const base = { APP_URL: "http://localhost:3000" };

		it.each([
			[undefined, 0],
			["", 0],
			["0", 0],
			["2", 2],
		])("parses %j as %j", (raw, expected) => {
			expect(
				parseServerEnv({ ...base, TRUSTED_PROXY_HOPS: raw }).TRUSTED_PROXY_HOPS,
			).toBe(expected);
		});

		it.each(["-1", "x", "1.5"])("rejects %j, naming the variable", (raw) => {
			expect(() =>
				parseServerEnv({ ...base, TRUSTED_PROXY_HOPS: raw }),
			).toThrow(/TRUSTED_PROXY_HOPS/);
		});
	});
});
