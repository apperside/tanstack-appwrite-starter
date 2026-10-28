import { describe, expect, it } from "vitest";
import {
	changeEmailSchema,
	changeNameSchema,
	changePasswordSchema,
	updatePreferencesSchema,
} from "./account.schemas";

describe("account schemas", () => {
	it("requires a current password and a valid new one", () => {
		expect(
			changePasswordSchema.safeParse({
				currentPassword: "",
				newPassword: "longenough",
			}).success,
		).toBe(false);
		expect(
			changePasswordSchema.safeParse({
				currentPassword: "x",
				newPassword: "short",
			}).success,
		).toBe(false);
		expect(
			changePasswordSchema.safeParse({
				currentPassword: "x",
				newPassword: "longenough",
			}).success,
		).toBe(true);
	});

	it("normalizes the new email and requires the password", () => {
		expect(
			changeEmailSchema.parse({ email: " A@B.test ", password: "x" }),
		).toEqual({
			email: "a@b.test",
			password: "x",
		});
		expect(
			changeEmailSchema.safeParse({ email: "a@b.test", password: "" }).success,
		).toBe(false);
	});

	it("trims the name", () => {
		expect(changeNameSchema.parse({ name: " Ann " })).toEqual({ name: "Ann" });
		expect(changeNameSchema.safeParse({ name: " " }).success).toBe(false);
	});

	it("accepts any subset of the preferences", () => {
		expect(updatePreferencesSchema.parse({})).toEqual({});
		expect(
			updatePreferencesSchema.parse({ theme: "dark", locale: "it" }),
		).toEqual({
			theme: "dark",
			locale: "it",
		});
	});

	it("rejects unknown values", () => {
		expect(updatePreferencesSchema.safeParse({ locale: "fr" }).success).toBe(
			false,
		);
		expect(updatePreferencesSchema.safeParse({ theme: "blue" }).success).toBe(
			false,
		);
		expect(
			updatePreferencesSchema.safeParse({ onboardingCompleted: "yes" }).success,
		).toBe(false);
	});
});
