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
import {
	confirmVerification,
	requestPasswordReset,
	resetPassword,
	sendVerification,
	signIn,
	signInAndMergeGuest,
	signOut,
	signOutEverywhere,
	signUp,
	startGuestSession,
	upgradeGuest,
} from "#/server/api/auth/auth.functions";

declare module "tanstack-query-typed" {
	interface AppMutationsRegistry {
		signOut: { response: Awaited<ReturnType<typeof signOut>> };
		signOutEverywhere: {
			response: Awaited<ReturnType<typeof signOutEverywhere>>;
		};
		signIn: { payload: SignInInput; response: User };
		signInAndMergeGuest: { payload: SignInInput; response: User };
		signUp: { payload: SignUpInput; response: User };
		upgradeGuest: { payload: SignUpInput; response: User };
		startGuestSession: { response: User };
		requestPasswordReset: {
			payload: RequestResetInput;
			response: Awaited<ReturnType<typeof requestPasswordReset>>;
		};
		resetPassword: {
			payload: ResetPasswordInput;
			response: Awaited<ReturnType<typeof resetPassword>>;
		};
		sendVerification: {
			response: Awaited<ReturnType<typeof sendVerification>>;
		};
		confirmVerification: {
			payload: ConfirmVerificationInput;
			response: Awaited<ReturnType<typeof confirmVerification>>;
		};
	}
}

// Run these through `useAuthMutation`, which refreshes the user and the guards.
// Each knows who is signed in afterwards (`nextUser`), so none re-reads it.

export const signOutMutation = {
	...appMutationOptions(["signOut"], { mutationFn: () => signOut() }),
	nextUser: null,
};

export const signOutEverywhereMutation = {
	...appMutationOptions(["signOutEverywhere"], {
		mutationFn: () => signOutEverywhere(),
	}),
	nextUser: null,
};

const returnedUser = (user: User) => user;

export const signInMutation = {
	...appMutationOptions(["signIn"], {
		mutationFn: (data) => signIn({ data }),
	}),
	nextUser: returnedUser,
};

export const signInAndMergeGuestMutation = {
	...appMutationOptions(["signInAndMergeGuest"], {
		mutationFn: (data) => signInAndMergeGuest({ data }),
	}),
	nextUser: returnedUser,
};

export const signUpMutation = {
	...appMutationOptions(["signUp"], {
		mutationFn: (data) => signUp({ data }),
	}),
	nextUser: returnedUser,
};

export const upgradeGuestMutation = {
	...appMutationOptions(["upgradeGuest"], {
		mutationFn: (data) => upgradeGuest({ data }),
	}),
	nextUser: returnedUser,
};

export const startGuestSessionMutation = {
	...appMutationOptions(["startGuestSession"], {
		mutationFn: () => startGuestSession(),
	}),
	nextUser: returnedUser,
};

/** Confirming an email changes the user (`emailVerification`): run it through `useAuthMutation`. */
export const confirmVerificationMutation = appMutationOptions(
	["confirmVerification"],
	{ mutationFn: (data) => confirmVerification({ data }) },
);

// These leave the signed-in user unchanged: plain `useMutation`.

export const requestPasswordResetMutation = appMutationOptions(
	["requestPasswordReset"],
	{ mutationFn: (data) => requestPasswordReset({ data }) },
);

export const resetPasswordMutation = appMutationOptions(["resetPassword"], {
	mutationFn: (data) => resetPassword({ data }),
});

export const sendVerificationMutation = appMutationOptions(
	["sendVerification"],
	{ mutationFn: () => sendVerification() },
);

/** Which form field shows a server error code; the rest are form errors. */
export const AUTH_FIELD_ERRORS: Partial<Record<AppErrorCode, string>> = {
	EMAIL_TAKEN: "email",
	WEAK_PASSWORD: "password",
};
