import { describe, expect, it } from "vitest";
import { AppError, type AppErrorCode } from "#/lib/errors";
import { fromPostgresError, translateErrors } from "./errors";

describe("fromPostgresError", () => {
	it.each<[string, AppErrorCode]>([
		["23505", "EMAIL_TAKEN"],
		["ECONNREFUSED", "NETWORK"],
		["57P01", "NETWORK"],
		["08006", "NETWORK"],
		["42P01", "UNKNOWN"],
	])("maps %s to %s and keeps the cause", (code, expected) => {
		const original = { code };
		const result = fromPostgresError(original);
		expect(result).toBeInstanceOf(AppError);
		expect((result as AppError).code).toBe(expected);
		expect((result as AppError).cause).toBe(original);
	});

	it("looks through a wrapping error's cause", () => {
		const wrapped = Object.assign(new Error("Failed query"), {
			cause: { code: "23505" },
		});
		expect((fromPostgresError(wrapped) as AppError).code).toBe("EMAIL_TAKEN");
	});

	it("passes an AppError through unchanged", () => {
		const error = new AppError("NOT_FOUND");
		expect(fromPostgresError(error)).toBe(error);
	});
});

describe("translateErrors", () => {
	it("rejects only with AppError", async () => {
		const wrapped = translateErrors({
			run: async () => {
				throw { code: "57P01" };
			},
		});
		await expect(wrapped.run()).rejects.toMatchObject({ code: "NETWORK" });
	});
});
