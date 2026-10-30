import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS } from "#/core/prefs";
import { AppError } from "#/lib/errors";
import { createTestContext } from "#/test/test-context";
import { completeOnboardingHandler } from "./onboarding.handlers.server";

describe("completeOnboardingHandler", () => {
	it("sets the name, then marks onboarding completed", async () => {
		const test = createTestContext();
		await test.seedUser();
		const result = await completeOnboardingHandler({
			data: { name: "Ann" },
			context: test.context,
		});
		expect(result).toEqual({ ...DEFAULT_PREFS, onboardingCompleted: true });
		await expect(test.context.session().getUser()).resolves.toMatchObject({
			name: "Ann",
			prefs: { onboardingCompleted: true },
		});
		const [nameCall] = test.session.updateName.mock.invocationCallOrder;
		const [prefsCall] = test.session.updatePrefs.mock.invocationCallOrder;
		expect(nameCall).toBeLessThan(prefsCall ?? 0);
	});

	it("skips the name when none is given", async () => {
		const test = createTestContext();
		await test.seedUser();
		await completeOnboardingHandler({ data: {}, context: test.context });
		expect(test.session.updateName).not.toHaveBeenCalled();
		expect(test.session.updatePrefs).toHaveBeenCalledWith(expect.any(String), {
			onboardingCompleted: true,
		});
	});

	it("is UNAUTHENTICATED when signed out", async () => {
		const test = createTestContext();
		await expect(
			completeOnboardingHandler({ data: {}, context: test.context }),
		).rejects.toEqual(new AppError("UNAUTHENTICATED"));
		expect(test.session.updatePrefs).not.toHaveBeenCalled();
	});
});
