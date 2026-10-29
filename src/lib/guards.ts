import type { User } from "#/core/auth/types";
import { sanitizeRedirect } from "./redirect";

export type GuardZone = "public" | "authed" | "app" | "onboarding";

/** An anonymous account: no email or password yet. */
export function isGuest(user: User): boolean {
	return user.isGuest;
}

type GuardInput = {
	zone: GuardZone;
	user: User | null;
	requireEmailVerification: boolean;
	/** Path plus search of the requested URL; round-tripped through `/login?redirect=`. */
	location: string;
	/** The requested URL's `redirect` param (`/login?redirect=`), sanitized here. */
	redirect?: unknown;
};

/** Where a request for `zone` must be sent instead, or `null` to let it through. */
export function resolveGuardRedirect({
	zone,
	user,
	requireEmailVerification,
	location,
	redirect,
}: GuardInput): string | null {
	// Guests may use the public pages: that is where they save their account
	// (`/signup?upgrade=1`, `/login?merge=1`). A registered user goes where
	// `?redirect=` asked (straight there after signing in, no hop via `/`).
	if (zone === "public") {
		return user && !isGuest(user) ? sanitizeRedirect(redirect) : null;
	}
	if (!user) return `/login?redirect=${encodeURIComponent(location)}`;

	const onboarded = user.prefs.onboardingCompleted;
	if (zone === "onboarding") return onboarded ? "/" : null;
	if (zone === "app") {
		if (requireEmailVerification && !isGuest(user) && !user.emailVerified) {
			return "/verify-email";
		}
		if (!onboarded) return "/onboarding";
	}
	return null;
}

/**
 * The `/verify-email` guard, deliberately outside the zones (an `app` or
 * `public` guard could loop with the verification redirect). An email link
 * works for anyone, signed in or not. Without one, the page resends to the
 * signed-in user's email: nobody signed in → sign in first; a guest (no email)
 * or an already verified user → home.
 */
export function resolveVerifyEmailRedirect({
	user,
	hasLink,
}: {
	user: User | null;
	hasLink: boolean;
}): string | null {
	if (hasLink) return null;
	if (!user) return `/login?redirect=${encodeURIComponent("/verify-email")}`;
	if (isGuest(user) || user.emailVerified) return "/";
	return null;
}
