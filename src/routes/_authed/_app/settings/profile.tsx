import { createFileRoute } from "@tanstack/react-router";
import { ProfileSettings } from "#/features/account/components/profile-settings";

export const Route = createFileRoute("/_authed/_app/settings/profile")({
	component: ProfileSettings,
});
