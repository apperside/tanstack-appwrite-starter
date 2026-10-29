import { describe, expect, it } from "vitest";
import { parseAppwritePublicEnv, parseAppwriteServerEnv } from "./env";

const validPublic = {
	VITE_APPWRITE_ENDPOINT: "https://cloud.appwrite.io/v1",
	VITE_APPWRITE_PROJECT_ID: "proj",
	VITE_APPWRITE_DATABASE_ID: "db",
};

describe("parseAppwritePublicEnv", () => {
	it("parses valid values", () => {
		expect(parseAppwritePublicEnv(validPublic)).toEqual({
			ENDPOINT: "https://cloud.appwrite.io/v1",
			PROJECT_ID: "proj",
			DATABASE_ID: "db",
		});
	});

	it("rejects a missing endpoint, naming the variable", () => {
		const { VITE_APPWRITE_ENDPOINT: _omit, ...rest } = validPublic;
		expect(() => parseAppwritePublicEnv(rest)).toThrow(
			/VITE_APPWRITE_ENDPOINT/,
		);
	});

	it("rejects a non-URL endpoint, naming the variable", () => {
		expect(() =>
			parseAppwritePublicEnv({
				...validPublic,
				VITE_APPWRITE_ENDPOINT: "nope",
			}),
		).toThrow(/VITE_APPWRITE_ENDPOINT/);
	});

	it("names every bad variable in one message", () => {
		expect(() =>
			parseAppwritePublicEnv({
				...validPublic,
				VITE_APPWRITE_ENDPOINT: "nope",
				VITE_APPWRITE_PROJECT_ID: "",
			}),
		).toThrow(/VITE_APPWRITE_ENDPOINT.*VITE_APPWRITE_PROJECT_ID/);
	});
});

describe("parseAppwriteServerEnv", () => {
	it("parses the API key", () => {
		expect(parseAppwriteServerEnv({ APPWRITE_API_KEY: "k" })).toEqual({
			APPWRITE_API_KEY: "k",
		});
	});

	it("rejects a missing API key", () => {
		expect(() => parseAppwriteServerEnv({})).toThrow(/APPWRITE_API_KEY/);
	});
});
