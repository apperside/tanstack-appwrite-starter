import { appMutationOptions } from "tanstack-query-typed";
import type {
	ChangeEmailInput,
	ChangeNameInput,
	ChangePasswordInput,
	UpdatePreferencesInput,
} from "#/lib/schemas/account.schemas";
import { api } from "#/server/api/api";

declare module "tanstack-query-typed" {
	interface AppMutationsRegistry {
		updatePreferences: {
			payload: UpdatePreferencesInput;
			response: Awaited<ReturnType<typeof api.account.updatePreferences>>;
		};
		changeName: {
			payload: ChangeNameInput;
			response: Awaited<ReturnType<typeof api.account.changeName>>;
		};
		changeEmail: {
			payload: ChangeEmailInput;
			response: Awaited<ReturnType<typeof api.account.changeEmail>>;
		};
		changePassword: {
			payload: ChangePasswordInput;
			response: Awaited<ReturnType<typeof api.account.changePassword>>;
		};
	}
}

/** Optimistic: run it through `usePreference`, which owns the cache and cookies. */
export const updatePreferencesMutation = appMutationOptions(
	["updatePreferences"],
	{ mutationFn: (data) => api.account.updatePreferences({ data }) },
);

// These change the account: run them through `useAuthMutation`, which re-reads
// the user (they return `{ ok: true }`, not the user).

export const changeNameMutation = appMutationOptions(["changeName"], {
	mutationFn: (data) => api.account.changeName({ data }),
});

export const changeEmailMutation = appMutationOptions(["changeEmail"], {
	mutationFn: (data) => api.account.changeEmail({ data }),
});

export const changePasswordMutation = appMutationOptions(["changePassword"], {
	mutationFn: (data) => api.account.changePassword({ data }),
});
