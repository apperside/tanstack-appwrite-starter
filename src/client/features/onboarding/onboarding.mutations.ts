import { appMutationOptions } from "tanstack-query-typed";
import type { CompleteOnboardingInput } from "#/lib/schemas/onboarding.schemas";
import { api } from "#/server/api/api";

declare module "tanstack-query-typed" {
	interface AppMutationsRegistry {
		completeOnboarding: {
			payload: CompleteOnboardingInput;
			response: Awaited<ReturnType<typeof api.onboarding.completeOnboarding>>;
		};
	}
}

/**
 * Run it through `useAuthMutation`: the guards must see the updated user
 * (`prefs.onboardingCompleted`), so it is re-read afterwards.
 */
export const completeOnboardingMutation = appMutationOptions(
	["completeOnboarding"],
	{ mutationFn: (data) => api.onboarding.completeOnboarding({ data }) },
);
