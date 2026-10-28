import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "#/components/layout/app-shell";
import { publicEnv } from "#/config/env";
import { resolveGuardRedirect } from "#/lib/guards";
import { getGuestBannerDismissed } from "#/server/guest-banner-preference";
import { getSidebarMode } from "#/server/sidebar-preference";

export const Route = createFileRoute("/_authed/_app")({
	beforeLoad: ({ context, location }) => {
		const href = resolveGuardRedirect({
			zone: "app",
			user: context.user,
			requireEmailVerification: publicEnv.REQUIRE_EMAIL_VERIFICATION,
			location: location.href,
		});
		if (href) throw redirect({ href });
	},
	// Read on the server so the first paint already has the chosen width and
	// banner (no layout shift).
	loader: async () => {
		const [sidebarMode, guestBannerDismissed] = await Promise.all([
			getSidebarMode(),
			getGuestBannerDismissed(),
		]);
		return { sidebarMode, guestBannerDismissed };
	},
	// The shell owns this state after the first load; never reload it on navigation.
	staleTime: Number.POSITIVE_INFINITY,
	component: AppLayout,
});

function AppLayout() {
	const { sidebarMode, guestBannerDismissed } = Route.useLoaderData();
	return (
		<AppShell
			sidebarMode={sidebarMode}
			guestBannerDismissed={guestBannerDismissed}
		>
			<Outlet />
		</AppShell>
	);
}
