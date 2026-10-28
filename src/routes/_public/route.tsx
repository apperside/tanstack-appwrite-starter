import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AuthFrame } from "#/components/layout/auth-layout";
import { PageSkeleton } from "#/components/layout/page-skeleton";
import { publicEnv } from "#/config/env";
import { resolveGuardRedirect } from "#/lib/guards";

/**
 * The signed-out pages. A registered user is sent home; a guest may stay (to
 * save their account). The frame lives here, so it stays put between pages.
 */
export const Route = createFileRoute("/_public")({
	beforeLoad: ({ context, location }) => {
		const href = resolveGuardRedirect({
			zone: "public",
			user: context.user,
			requireEmailVerification: publicEnv.REQUIRE_EMAIL_VERIFICATION,
			location: location.href,
			redirect: (location.search as { redirect?: unknown }).redirect,
		});
		if (href) throw redirect({ href });
	},
	pendingComponent: () => <PageSkeleton variant="form" />,
	component: PublicLayout,
});

function PublicLayout() {
	return (
		<AuthFrame>
			<Outlet />
		</AuthFrame>
	);
}
