import type { AppPrefs } from "#/core/prefs";
import { savePrefs } from "#/server/account-prefs.server";
import type { HandlerArgs } from "#/server/context";
import { requireUser } from "#/server/require-user";
import type { CompleteOnboardingInput } from "./onboarding.schemas";

/** Optionally sets the name, then marks onboarding as completed. */
export async function completeOnboardingHandler({
	data,
	context,
}: HandlerArgs<CompleteOnboardingInput>): Promise<Partial<AppPrefs>> {
	await requireUser(context);
	if (data.name) {
		await context.session().updateName(data.name);
	}
	return savePrefs(context, { onboardingCompleted: true });
}
