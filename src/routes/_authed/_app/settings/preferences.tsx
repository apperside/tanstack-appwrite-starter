import { createFileRoute } from "@tanstack/react-router";
import { PreferencesSettings } from "#/features/account/components/preferences-settings";

export const Route = createFileRoute("/_authed/_app/settings/preferences")({
	component: PreferencesSettings,
});
