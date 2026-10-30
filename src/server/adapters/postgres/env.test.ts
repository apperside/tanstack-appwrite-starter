import { describe, expect, it } from "vitest";
import { parsePostgresEnv } from "./env";

describe("parsePostgresEnv", () => {
	it("parses a valid URL", () => {
		const DATABASE_URL = "postgres://user:pw@localhost:5432/app";
		expect(parsePostgresEnv({ DATABASE_URL })).toEqual({ DATABASE_URL });
	});

	it("rejects a missing DATABASE_URL, naming the variable", () => {
		expect(() => parsePostgresEnv({})).toThrow(/DATABASE_URL/);
	});

	it("rejects a non-URL DATABASE_URL, naming the variable", () => {
		expect(() => parsePostgresEnv({ DATABASE_URL: "nope" })).toThrow(
			/DATABASE_URL/,
		);
	});
});
