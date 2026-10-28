import { describe, expect, it } from "vitest";
import { loadI18n } from "#/i18n/i18n";
import { AppError } from "#/lib/errors";
import { fieldErrorMessage } from "./field-error";

const { t } = await loadI18n("en");
const message = (error: unknown) => fieldErrorMessage(error, t);

describe("fieldErrorMessage", () => {
	it("translates zod string issues", () => {
		expect(message({ code: "invalid_format", format: "email" })).toBe(
			"Enter a valid email address",
		);
		expect(message({ code: "too_small", origin: "string", minimum: 1 })).toBe(
			"This field is required",
		);
		expect(message({ code: "too_small", origin: "string", minimum: 8 })).toBe(
			"Use at least 8 characters",
		);
		expect(message({ code: "too_big", origin: "string", maximum: 256 })).toBe(
			"Use at most 256 characters",
		);
	});

	it("falls back to a generic message for anything else", () => {
		for (const issue of [
			{ code: "invalid_format", format: "url" },
			{ code: "too_small", origin: "number", minimum: 3 },
			{ code: "too_big", origin: "array", maximum: 3 },
			{ code: "custom" },
			null,
			42,
		]) {
			expect(message(issue)).toBe("Check this value");
		}
	});

	it("translates an AppError and passes a custom string through", () => {
		expect(message(new AppError("FORBIDDEN"))).toBe(
			"You don't have permission to do this.",
		);
		expect(message("Already translated")).toBe("Already translated");
	});
});
