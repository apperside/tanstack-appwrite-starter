import {
	getGuestBannerDismissed,
	getLocaleHints,
	getSidebarMode,
	getThemePreference,
} from "#/server/functions/preferences";
import {
	changeEmail,
	changeName,
	changePassword,
	listSessions,
	updatePreferences,
} from "./account/account.functions";
import {
	confirmVerification,
	getCurrentUser,
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
} from "./auth/auth.functions";
import { completeOnboarding } from "./onboarding/onboarding.functions";

/**
 * The only way client code reaches the server: every server function by
 * feature, plus the preference reads (isomorphic: the request during SSR, the
 * document on the client). Outside `src/server`, nothing else from it may be
 * imported (biome's `noRestrictedImports`).
 */
export const api = {
	auth: {
		getCurrentUser,
		signIn,
		signUp,
		signOut,
		signOutEverywhere,
		startGuestSession,
		upgradeGuest,
		signInAndMergeGuest,
		requestPasswordReset,
		resetPassword,
		sendVerification,
		confirmVerification,
	},
	account: {
		listSessions,
		changePassword,
		changeEmail,
		changeName,
		updatePreferences,
	},
	onboarding: {
		completeOnboarding,
	},
	preferences: {
		getThemePreference,
		getLocaleHints,
		getSidebarMode,
		getGuestBannerDismissed,
	},
};
