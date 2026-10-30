import { appMutationOptions } from "tanstack-query-typed";
import type { User } from "#/core/auth/types";
import type { AppErrorCode } from "#/lib/errors";
import type {
	ConfirmVerificationInput,
	RequestResetInput,
	ResetPasswordInput,
	SignInInput,
	SignUpInput,
} from "#/lib/schemas/auth.schemas";
import { api } from "#/server/api/api";

declare module "tanstack-query-typed" {
	interface AppMutationsRegistry {
		signOut: { response: Awaited<ReturnType<typeof api.auth.signOut>> };
		signOutEverywhere: {
			response: Awaited<ReturnType<typeof api.auth.signOutEverywhere>>;
		};
		signIn: { payload: SignInInput; response: User };
		signInAndMergeGuest: { payload: SignInInput; response: User };
		signUp: { payload: SignUpInput; response: User };
		upgradeGuest: { payload: SignUpInput; response: User };
		startGuestSession: { response: User };
		requestPasswordReset: {
			payload: RequestResetInput;
			response: Awaited<ReturnType<typeof api.auth.requestPasswordReset>>;
		};
		resetPassword: {
			payload: ResetPasswordInput;
			response: Awaited<ReturnType<typeof api.auth.resetPassword>>;
		};
		sendVerification: {
			response: Awaited<ReturnType<typeof api.auth.sendVerification>>;
		};
		confirmVerification: {
			payload: ConfirmVerificationInput;
			response: Awaited<ReturnType<typeof api.auth.confirmVerification>>;
		};
	}
}

// Run these through `useAuthMutation`, which refreshes the user and the guards.
// Each knows who is signed in afterwards (`nextUser`), so none re-reads it.

export const signOutMutation = {
	...appMutationOptions(["signOut"], { mutationFn: () => api.auth.signOut() }),
	nextUser: null,
};

export const signOutEverywhereMutation = {
	...appMutationOptions(["signOutEverywhere"], {
		mutationFn: () => api.auth.signOutEverywhere(),
	}),
	nextUser: null,
};

const returnedUser = (user: User) => user;

export const signInMutation = {
	...appMutationOptions(["signIn"], {
		mutationFn: (data) => api.auth.signIn({ data }),
	}),
	nextUser: returnedUser,
};

export const signInAndMergeGuestMutation = {
	...appMutationOptions(["signInAndMergeGuest"], {
		mutationFn: (data) => api.auth.signInAndMergeGuest({ data }),
	}),
	nextUser: returnedUser,
};

export const signUpMutation = {
	...appMutationOptions(["signUp"], {
		mutationFn: (data) => api.auth.signUp({ data }),
	}),
	nextUser: returnedUser,
};

export const upgradeGuestMutation = {
	...appMutationOptions(["upgradeGuest"], {
		mutationFn: (data) => api.auth.upgradeGuest({ data }),
	}),
	nextUser: returnedUser,
};

export const startGuestSessionMutation = {
	...appMutationOptions(["startGuestSession"], {
		mutationFn: () => api.auth.startGuestSession(),
	}),
	nextUser: returnedUser,
};

/** Confirming an email changes the user (`emailVerification`): run it through `useAuthMutation`. */
export const confirmVerificationMutation = appMutationOptions(
	["confirmVerification"],
	{ mutationFn: (data) => api.auth.confirmVerification({ data }) },
);

// These leave the signed-in user unchanged: plain `useMutation`.

export const requestPasswordResetMutation = appMutationOptions(
	["requestPasswordReset"],
	{ mutationFn: (data) => api.auth.requestPasswordReset({ data }) },
);

export const resetPasswordMutation = appMutationOptions(["resetPassword"], {
	mutationFn: (data) => api.auth.resetPassword({ data }),
});

export const sendVerificationMutation = appMutationOptions(
	["sendVerification"],
	{ mutationFn: () => api.auth.sendVerification() },
);

/** Which form field shows a server error code; the rest are form errors. */
export const AUTH_FIELD_ERRORS: Partial<Record<AppErrorCode, string>> = {
	EMAIL_TAKEN: "email",
	WEAK_PASSWORD: "password",
};
