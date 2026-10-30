import { AppwriteException as BrowserAppwriteException } from "appwrite";
import { describe, expect, it, vi } from "vitest";
import { AppError, type AppErrorCode } from "#/lib/errors";
import { appwriteError } from "#/test/appwrite-error";
import { fromAppwriteError, translateErrors } from "./errors";

const toCode = (error: unknown) => (fromAppwriteError(error) as AppError).code;

describe("fromAppwriteError", () => {
	it.each<[string, AppErrorCode]>([
		["user_invalid_credentials", "INVALID_CREDENTIALS"],
		["user_password_mismatch", "INVALID_CREDENTIALS"],
		["user_already_exists", "EMAIL_TAKEN"],
		["user_email_already_exists", "EMAIL_TAKEN"],
		["password_recently_used", "WEAK_PASSWORD"],
		["password_personal_data", "WEAK_PASSWORD"],
		["password_pwned", "WEAK_PASSWORD"],
		["user_invalid_token", "INVALID_TOKEN"],
		["user_unauthorized", "UNAUTHENTICATED"],
		["general_unauthorized_scope", "UNAUTHENTICATED"],
		["user_session_not_found", "UNAUTHENTICATED"],
		["user_jwt_invalid", "UNAUTHENTICATED"],
		["general_rate_limit_exceeded", "RATE_LIMITED"],
		["row_not_found", "NOT_FOUND"],
		["document_not_found", "NOT_FOUND"],
		["user_not_found", "NOT_FOUND"],
	])("maps Appwrite %s to %s", (type, code) => {
		expect(toCode(appwriteError(type))).toBe(code);
	});

	it("maps an unlisted Appwrite type to UNKNOWN", () => {
		expect(toCode(appwriteError("general_server_error", 500))).toBe("UNKNOWN");
	});

	it("maps browser SDK exceptions", () => {
		const error = new BrowserAppwriteException("x", 401, "user_jwt_invalid");
		expect(toCode(error)).toBe("UNAUTHENTICATED");
	});

	it("ignores Object.prototype keys as Appwrite types", () => {
		expect(toCode(appwriteError("constructor"))).toBe("UNKNOWN");
		expect(toCode(appwriteError("toString"))).toBe("UNKNOWN");
	});

	it("keeps the exception as the cause", () => {
		const error = appwriteError("user_invalid_credentials", 401);
		expect((fromAppwriteError(error) as AppError).cause).toBe(error);
	});

	it("leaves anything else unchanged", () => {
		const error = new TypeError("fetch failed");
		expect(fromAppwriteError(error)).toBe(error);
	});
});

describe("translateErrors", () => {
	it("translates rejections and passes results through", async () => {
		const methods = translateErrors({
			ok: vi.fn(async (value: number) => value * 2),
			fail: vi.fn(async () => {
				throw appwriteError("user_already_exists", 409);
			}),
		});
		await expect(methods.ok(2)).resolves.toBe(4);
		await expect(methods.fail()).rejects.toEqual(new AppError("EMAIL_TAKEN"));
	});
});
