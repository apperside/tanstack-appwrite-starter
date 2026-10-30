/**
 * `/onboarding`: shown once, after sign-up or "continue as guest", until
 * `prefs.onboardingCompleted`. The boilerplate asks only for a name; apps add
 * their own steps to `OnboardingPage` (or turn it into a multi-step flow here),
 * then call `completeOnboarding` at the end so the `app` guard lets the user in.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";
import { PageSkeleton } from "#/client/components/layout/page-skeleton";
import { OnboardingPage } from "#/client/features/onboarding/components/onboarding-page";
import { publicEnv } from "#/config/env";
import { resolveGuardRedirect } from "#/lib/guards";

export const Route = createFileRoute("/_authed/onboarding")({
	beforeLoad: ({ context, location }) => {
		const href = resolveGuardRedirect({
			zone: "onboarding",
			user: context.user,
			requireEmailVerification: publicEnv.REQUIRE_EMAIL_VERIFICATION,
			location: location.href,
		});
		if (href) throw redirect({ href });
	},
	pendingComponent: () => <PageSkeleton variant="form" />,
	component: OnboardingPage,
});
