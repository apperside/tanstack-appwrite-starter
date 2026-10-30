import type { AppPrefs } from "#/core/prefs";
import type { CompleteOnboardingInput } from "#/lib/schemas/onboarding.schemas";
import type { HandlerArgs } from "#/server/context/context.types";
import { requireUser } from "#/server/require-user";
import { savePrefs } from "#/server/utils/account-prefs.server";

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
