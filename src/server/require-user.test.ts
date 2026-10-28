import { describe, expect, it } from "vitest";
import { AppError } from "#/lib/errors";
import { aGuest, aUser } from "#/test/fixtures";
import { createTestContext } from "#/test/test-context";
import { requireRegisteredUser, requireUser } from "./require-user";

describe("requireUser", () => {
	it("returns the signed-in user, guest or not", async () => {
		const guest = aGuest();
		const { context } = createTestContext({ user: guest });
		await expect(requireUser(context)).resolves.toBe(guest);
	});

	it("is UNAUTHENTICATED when signed out", async () => {
		const { context } = createTestContext({ user: null });
		await expect(requireUser(context)).rejects.toEqual(
			new AppError("UNAUTHENTICATED"),
		);
	});
});

describe("requireRegisteredUser", () => {
	it("returns a registered user", async () => {
		const user = aUser();
		const { context } = createTestContext({ user });
		await expect(requireRegisteredUser(context)).resolves.toBe(user);
	});

	it("is FORBIDDEN for a guest, who has no email or password", async () => {
		const { context } = createTestContext({ user: aGuest() });
		await expect(requireRegisteredUser(context)).rejects.toEqual(
			new AppError("FORBIDDEN"),
		);
	});

	it("is UNAUTHENTICATED when signed out", async () => {
		const { context } = createTestContext({ user: null });
		await expect(requireRegisteredUser(context)).rejects.toEqual(
			new AppError("UNAUTHENTICATED"),
		);
	});
});
