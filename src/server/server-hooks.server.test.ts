import { describe, expect, it } from "vitest";
import { createTestContext } from "#/test/test-context";
import { serverHooks } from "./server-hooks.server";

describe("serverHooks", () => {
	it("does nothing on guest merge by default", async () => {
		const { context } = createTestContext();
		await expect(
			serverHooks.onGuestMerge({
				guestUserId: "guest-1",
				userId: "user-1",
				admin: context.appwrite.admin(),
			}),
		).resolves.toBeUndefined();
	});
});
