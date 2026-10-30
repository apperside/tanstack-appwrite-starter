import { appMutationOptions } from "tanstack-query-typed";
import type {
	ChangeEmailInput,
	ChangeNameInput,
	ChangePasswordInput,
	UpdatePreferencesInput,
} from "#/lib/schemas/account.schemas";
import {
	changeEmail,
	changeName,
	changePassword,
	updatePreferences,
} from "#/server/api/account/account.functions";

declare module "tanstack-query-typed" {
	interface AppMutationsRegistry {
		updatePreferences: {
			payload: UpdatePreferencesInput;
			response: Awaited<ReturnType<typeof updatePreferences>>;
		};
		changeName: {
			payload: ChangeNameInput;
			response: Awaited<ReturnType<typeof changeName>>;
		};
		changeEmail: {
			payload: ChangeEmailInput;
			response: Awaited<ReturnType<typeof changeEmail>>;
		};
		changePassword: {
			payload: ChangePasswordInput;
			response: Awaited<ReturnType<typeof changePassword>>;
		};
	}
}

/** Optimistic: run it through `usePreference`, which owns the cache and cookies. */
export const updatePreferencesMutation = appMutationOptions(
	["updatePreferences"],
	{ mutationFn: (data) => updatePreferences({ data }) },
);

// These change the account: run them through `useAuthMutation`, which re-reads
// the user (they return `{ ok: true }`, not the user).

export const changeNameMutation = appMutationOptions(["changeName"], {
	mutationFn: (data) => changeName({ data }),
});

export const changeEmailMutation = appMutationOptions(["changeEmail"], {
	mutationFn: (data) => changeEmail({ data }),
});

export const changePasswordMutation = appMutationOptions(["changePassword"], {
	mutationFn: (data) => changePassword({ data }),
});
