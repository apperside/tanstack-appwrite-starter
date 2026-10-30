import { describe, expect, it } from "vitest";
import { parseMailEnv } from "./env";

describe("parseMailEnv", () => {
	it("defaults to console and needs no sender", () => {
		expect(parseMailEnv({})).toEqual({
			MAIL_PROVIDER: "console",
			MAIL_FROM: "",
		});
	});

	it("reads blank values as unset", () => {
		expect(parseMailEnv({ MAIL_PROVIDER: "", MAIL_FROM: "" })).toEqual({
			MAIL_PROVIDER: "console",
			MAIL_FROM: "",
		});
	});

	it("requires MAIL_FROM for a real provider", () => {
		expect(() => parseMailEnv({ MAIL_PROVIDER: "smtp" })).toThrow(/MAIL_FROM/);
	});

	it("rejects an unknown provider", () => {
		expect(() => parseMailEnv({ MAIL_PROVIDER: "pigeon" })).toThrow(
			/MAIL_PROVIDER/,
		);
	});
});
