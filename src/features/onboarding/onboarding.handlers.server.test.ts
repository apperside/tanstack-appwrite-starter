import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS } from "#/lib/appwrite/app-models";
import { AppError } from "#/lib/errors";
import { aUser } from "#/test/fixtures";
import { createTestContext } from "#/test/test-context";
import { completeOnboardingHandler } from "./onboarding.handlers.server";

function setup() {
	const ctx = createTestContext({ user: aUser() });
	ctx.userAccount.getPrefs.mockResolvedValue({ ...DEFAULT_PREFS });
	ctx.userAccount.updatePrefs.mockResolvedValue({} as never);
	ctx.userAccount.updateName.mockResolvedValue({} as never);
	return ctx;
}

describe("completeOnboardingHandler", () => {
	it("sets the name, then marks onboarding completed", async () => {
		const { context, userAccount } = setup();
		const result = await completeOnboardingHandler({
			data: { name: "Ann" },
			context,
		});
		expect(userAccount.updateName).toHaveBeenCalledWith({ name: "Ann" });
		expect(userAccount.updatePrefs).toHaveBeenCalledWith({
			prefs: { ...DEFAULT_PREFS, onboardingCompleted: true },
		});
		expect(result).toEqual({ ...DEFAULT_PREFS, onboardingCompleted: true });
	});

	it("skips the name when none is given", async () => {
		const { context, userAccount } = setup();
		await completeOnboardingHandler({ data: {}, context });
		expect(userAccount.updateName).not.toHaveBeenCalled();
		expect(userAccount.updatePrefs).toHaveBeenCalledWith({
			prefs: { ...DEFAULT_PREFS, onboardingCompleted: true },
		});
	});

	it("is UNAUTHENTICATED when signed out", async () => {
		const { context, userAccount } = createTestContext({ user: null });
		await expect(
			completeOnboardingHandler({ data: {}, context }),
		).rejects.toEqual(new AppError("UNAUTHENTICATED"));
		expect(userAccount.updatePrefs).not.toHaveBeenCalled();
	});
});
