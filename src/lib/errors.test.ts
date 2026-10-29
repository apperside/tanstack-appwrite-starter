import { describe, expect, it } from "vitest";
import { AppError, toAppError } from "./errors";

describe("AppError", () => {
	it("uses the code as its message so it survives serialization", () => {
		const error = new AppError("FORBIDDEN");
		expect(error.message).toBe("FORBIDDEN");
		expect(error.name).toBe("AppError");
		expect(error.code).toBe("FORBIDDEN");
		expect(error.i18nKey).toBe("errors:FORBIDDEN");
		expect(error).toBeInstanceOf(Error);
	});

	it("keeps the original error as its cause", () => {
		const original = new Error("vendor");
		expect(new AppError("UNKNOWN", { cause: original }).cause).toBe(original);
	});
});

describe("toAppError", () => {
	it("recognizes a plain Error whose message is a known code", () => {
		expect(toAppError(new Error("RATE_LIMITED")).code).toBe("RATE_LIMITED");
	});

	it("returns an AppError unchanged", () => {
		const error = new AppError("FORBIDDEN");
		expect(toAppError(error)).toBe(error);
	});

	it.each([
		"Failed to fetch",
		"NetworkError when attempting to fetch resource.",
		"Load failed",
		"fetch failed",
	])("maps the fetch TypeError %j to NETWORK", (message) => {
		expect(toAppError(new TypeError(message)).code).toBe("NETWORK");
	});

	it("maps a non-fetch TypeError to UNKNOWN", () => {
		expect(toAppError(new TypeError("undefined is not a function")).code).toBe(
			"UNKNOWN",
		);
	});

	it.each([
		["a plain object", {}],
		["an unknown message", new Error("boom")],
		["a non-error", "oops"],
	])("maps %s to UNKNOWN", (_label, value) => {
		expect(toAppError(value).code).toBe("UNKNOWN");
	});
});
