import { describe, expect, it } from "vitest";
import { parsePublicEnv, parseServerEnv } from "./env";

const validPublic = {
	VITE_APPWRITE_ENDPOINT: "https://cloud.appwrite.io/v1",
	VITE_APPWRITE_PROJECT_ID: "proj",
	VITE_APPWRITE_DATABASE_ID: "db",
};

describe("parsePublicEnv", () => {
	it("parses valid values", () => {
		expect(parsePublicEnv(validPublic)).toEqual({
			APPWRITE_ENDPOINT: "https://cloud.appwrite.io/v1",
			APPWRITE_PROJECT_ID: "proj",
			APPWRITE_DATABASE_ID: "db",
			REQUIRE_EMAIL_VERIFICATION: false,
		});
	});

	it("rejects a missing endpoint, naming the variable", () => {
		const { VITE_APPWRITE_ENDPOINT: _omit, ...rest } = validPublic;
		expect(() => parsePublicEnv(rest)).toThrow(/VITE_APPWRITE_ENDPOINT/);
	});

	it("rejects a non-URL endpoint, naming the variable", () => {
		expect(() =>
			parsePublicEnv({ ...validPublic, VITE_APPWRITE_ENDPOINT: "nope" }),
		).toThrow(/VITE_APPWRITE_ENDPOINT/);
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

	it("names every bad variable in one message", () => {
		expect(() =>
			parsePublicEnv({
				...validPublic,
				VITE_APPWRITE_ENDPOINT: "nope",
				VITE_APPWRITE_PROJECT_ID: "",
			}),
		).toThrow(/VITE_APPWRITE_ENDPOINT.*VITE_APPWRITE_PROJECT_ID/);
	});
});

describe("parseServerEnv", () => {
	it("parses valid values", () => {
		expect(
			parseServerEnv({
				APPWRITE_API_KEY: "k",
				APP_URL: "http://localhost:3000",
			}),
		).toEqual({
			APPWRITE_API_KEY: "k",
			APP_URL: "http://localhost:3000",
			TRUSTED_PROXY_HOPS: 0,
		});
	});

	it("rejects a non-URL APP_URL, naming the variable", () => {
		expect(() =>
			parseServerEnv({ APPWRITE_API_KEY: "k", APP_URL: "not a url" }),
		).toThrow(/APP_URL/);
	});

	it("rejects a missing API key", () => {
		expect(() => parseServerEnv({ APP_URL: "http://localhost:3000" })).toThrow(
			/APPWRITE_API_KEY/,
		);
	});

	describe("TRUSTED_PROXY_HOPS", () => {
		const base = { APPWRITE_API_KEY: "k", APP_URL: "http://localhost:3000" };

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
