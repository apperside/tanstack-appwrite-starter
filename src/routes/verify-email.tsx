import { createFileRoute, redirect } from "@tanstack/react-router";
import { PageSkeleton } from "#/client/components/layout/page-skeleton";
import { VerifyEmailPage } from "#/client/features/auth/components/verify-email-page";
import { resolveVerifyEmailRedirect } from "#/lib/guards";
import { emailLinkSearchSchema } from "#/lib/schemas/auth.schemas";

// Top-level, outside the zones: a verification link works signed in or not.
export const Route = createFileRoute("/verify-email")({
	validateSearch: emailLinkSearchSchema,
	beforeLoad: ({ context, search, cause }) => {
		// Entering decides. Staying (the page dropping the link from the URL, or
		// refreshing the user once confirmed) must not bounce the page it shows.
		if (cause === "stay") return;
		const href = resolveVerifyEmailRedirect({
			user: context.user,
			hasLink: Object.keys(search).length > 0,
		});
		if (href) throw redirect({ href });
	},
	pendingComponent: () => <PageSkeleton variant="form" />,
	component: VerifyEmail,
});

function VerifyEmail() {
	return <VerifyEmailPage link={Route.useSearch()} />;
}
