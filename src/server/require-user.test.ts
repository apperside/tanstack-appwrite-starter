import { describe, expect, it } from "vitest";
import { AppError } from "#/lib/errors";
import { createTestContext } from "#/test/test-context";
import { requireRegisteredUser, requireUser } from "./require-user";

describe("requireUser", () => {
	it("returns the signed-in user, guest or not", async () => {
		const test = createTestContext();
		const { user } = await test.seedGuest();
		await expect(requireUser(test.context)).resolves.toEqual(user);
	});

	it("is UNAUTHENTICATED when signed out", async () => {
		const { context } = createTestContext();
		await expect(requireUser(context)).rejects.toEqual(
			new AppError("UNAUTHENTICATED"),
		);
	});
});

describe("requireRegisteredUser", () => {
	it("returns a registered user", async () => {
		const test = createTestContext();
		const { user } = await test.seedUser();
		await expect(requireRegisteredUser(test.context)).resolves.toEqual(user);
	});

	it("is FORBIDDEN for a guest, who has no email or password", async () => {
		const test = createTestContext();
		await test.seedGuest();
		await expect(requireRegisteredUser(test.context)).rejects.toEqual(
			new AppError("FORBIDDEN"),
		);
	});

	it("is UNAUTHENTICATED when signed out", async () => {
		const { context } = createTestContext();
		await expect(requireRegisteredUser(context)).rejects.toEqual(
			new AppError("UNAUTHENTICATED"),
		);
	});
});
