import { AppwriteException as BrowserAppwriteException } from "appwrite";
import { describe, expect, it } from "vitest";
import { appwriteError } from "#/test/appwrite-error";
import { AppError, type AppErrorCode, toAppError } from "./errors";

describe("AppError", () => {
	it("uses the code as its message so it survives serialization", () => {
		const error = new AppError("FORBIDDEN");
		expect(error.message).toBe("FORBIDDEN");
		expect(error.name).toBe("AppError");
		expect(error.code).toBe("FORBIDDEN");
		expect(error.i18nKey).toBe("errors:FORBIDDEN");
		expect(error).toBeInstanceOf(Error);
	});
});

describe("toAppError", () => {
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
		expect(toAppError(appwriteError(type)).code).toBe(code);
	});

	it("maps an unlisted Appwrite type to UNKNOWN", () => {
		expect(toAppError(appwriteError("general_server_error", 500)).code).toBe(
			"UNKNOWN",
		);
	});

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

	it("maps browser SDK exceptions", () => {
		const error = new BrowserAppwriteException("x", 401, "user_jwt_invalid");
		expect(toAppError(error).code).toBe("UNAUTHENTICATED");
	});

	it("ignores Object.prototype keys as Appwrite types", () => {
		expect(toAppError(appwriteError("constructor")).code).toBe("UNKNOWN");
		expect(toAppError(appwriteError("toString")).code).toBe("UNKNOWN");
	});

	it.each([
		["a plain object", {}],
		["an unknown message", new Error("boom")],
		["a non-error", "oops"],
	])("maps %s to UNKNOWN", (_label, value) => {
		expect(toAppError(value).code).toBe("UNKNOWN");
	});
});
