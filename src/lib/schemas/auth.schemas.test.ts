import { describe, expect, it } from "vitest";
import {
	confirmVerificationSchema,
	emailLinkSearchSchema,
	emailSchema,
	loginSearchSchema,
	NAME_MAX_LENGTH,
	nameSchema,
	passwordSchema,
	requestResetSchema,
	resetPasswordSchema,
	signInSchema,
	signUpSchema,
	signupSearchSchema,
} from "./auth.schemas";

describe("auth schemas", () => {
	it("trims and lower-cases the email", () => {
		expect(emailSchema.parse("  Ann@Example.COM ")).toBe("ann@example.com");
	});

	it("rejects an invalid email", () => {
		expect(emailSchema.safeParse("nope").success).toBe(false);
	});

	it("accepts passwords of 8 to 256 characters only", () => {
		expect(passwordSchema.safeParse("a".repeat(7)).success).toBe(false);
		expect(passwordSchema.safeParse("a".repeat(8)).success).toBe(true);
		expect(passwordSchema.safeParse("a".repeat(256)).success).toBe(true);
		expect(passwordSchema.safeParse("a".repeat(257)).success).toBe(false);
	});

	it("trims the name and bounds it to 1 to 128 characters", () => {
		expect(nameSchema.parse("  Ann ")).toBe("Ann");
		expect(nameSchema.safeParse("   ").success).toBe(false);
		expect(nameSchema.safeParse("a".repeat(NAME_MAX_LENGTH)).success).toBe(
			true,
		);
		expect(nameSchema.safeParse("a".repeat(NAME_MAX_LENGTH + 1)).success).toBe(
			false,
		);
		expect(NAME_MAX_LENGTH).toBe(128);
	});

	it("composes the sign-in and sign-up forms", () => {
		expect(
			signInSchema.parse({ email: " A@B.co ", password: "password1" }),
		).toEqual({ email: "a@b.co", password: "password1" });
		expect(
			signUpSchema.parse({
				name: " Ann ",
				email: "a@b.co",
				password: "password1",
			}),
		).toEqual({ name: "Ann", email: "a@b.co", password: "password1" });
		expect(signUpSchema.safeParse({ email: "a@b.co" }).success).toBe(false);
	});
});

describe("recovery and verification schemas", () => {
	it("normalizes the email of a reset request", () => {
		expect(requestResetSchema.parse({ email: " A@B.test " })).toEqual({
			email: "a@b.test",
		});
	});

	it("passes a link's parameters through, within bounds", () => {
		const link = { userId: "u", secret: "s" };
		expect(confirmVerificationSchema.parse({ link })).toEqual({ link });
		expect(confirmVerificationSchema.parse({ link: { token: "t" } })).toEqual({
			link: { token: "t" },
		});
		for (const bad of [
			{},
			{ userId: "" },
			{ "": "x" },
			{ k: "x".repeat(2049) },
			Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`k${i}`, "v"])),
		]) {
			expect(confirmVerificationSchema.safeParse({ link: bad }).success).toBe(
				false,
			);
		}
	});

	it("validates the new password of a reset", () => {
		const input = {
			link: { userId: "u", secret: "s" },
			password: "long-enough",
		};
		expect(resetPasswordSchema.safeParse(input).success).toBe(true);
		expect(
			resetPasswordSchema.safeParse({ ...input, password: "short" }).success,
		).toBe(false);
		expect(resetPasswordSchema.safeParse({ ...input, link: {} }).success).toBe(
			false,
		);
	});
});

describe("page search schemas", () => {
	it("keeps a string redirect and the numeric flags", () => {
		expect(
			loginSearchSchema.parse({ redirect: "/settings?tab=1", merge: 1 }),
		).toEqual({ redirect: "/settings?tab=1", merge: 1 });
		expect(signupSearchSchema.parse({ upgrade: 1 })).toEqual({ upgrade: 1 });
	});

	it("drops junk instead of failing the route", () => {
		expect(loginSearchSchema.parse({ redirect: 42, merge: "yes" })).toEqual({
			redirect: undefined,
			merge: undefined,
		});
		expect(signupSearchSchema.parse({ upgrade: true })).toEqual({
			upgrade: undefined,
		});
	});

	it("reads an email link whose ids look numeric as strings", () => {
		// `?userId=123&secret=456` is parsed as numbers by the router.
		expect(emailLinkSearchSchema.parse({ userId: 123, secret: 456 })).toEqual({
			userId: "123",
			secret: "456",
		});
		expect(
			emailLinkSearchSchema.parse({ userId: "65e12", secret: "s1" }),
		).toEqual({ userId: "65e12", secret: "s1" });
	});

	it("drops empty and non-string values, and anything not an object", () => {
		expect(
			emailLinkSearchSchema.parse({ userId: "", secret: { x: 1 }, token: "t" }),
		).toStrictEqual({ token: "t" });
		expect(emailLinkSearchSchema.parse("junk")).toStrictEqual({});
	});
});
