import { appMutationOptions } from "tanstack-query-typed";
import { completeOnboarding } from "./onboarding.functions";
import type { CompleteOnboardingInput } from "./onboarding.schemas";

declare module "tanstack-query-typed" {
	interface AppMutationsRegistry {
		completeOnboarding: {
			payload: CompleteOnboardingInput;
			response: Awaited<ReturnType<typeof completeOnboarding>>;
		};
	}
}

/**
 * Run it through `useAuthMutation`: the guards must see the updated user
 * (`prefs.onboardingCompleted`), so it is re-read afterwards.
 */
export const completeOnboardingMutation = appMutationOptions(
	["completeOnboarding"],
	{ mutationFn: (data) => completeOnboarding({ data }) },
);
