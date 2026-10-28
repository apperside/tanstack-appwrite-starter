import { createFileRoute, redirect } from "@tanstack/react-router";

// `/settings` (the navigation's target) opens the first section.
export const Route = createFileRoute("/_authed/_app/settings/")({
	beforeLoad: () => {
		throw redirect({ to: "/settings/profile", replace: true });
	},
});
