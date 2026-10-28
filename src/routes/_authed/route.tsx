import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { publicEnv } from "#/config/env";
import { resolveGuardRedirect } from "#/lib/guards";

export const Route = createFileRoute("/_authed")({
	beforeLoad: ({ context, location }) => {
		const href = resolveGuardRedirect({
			zone: "authed",
			user: context.user,
			requireEmailVerification: publicEnv.REQUIRE_EMAIL_VERIFICATION,
			location: location.href,
		});
		if (href) throw redirect({ href });
	},
	component: Outlet,
});
