import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SettingsLayout } from "#/features/account/components/settings-layout";

export const Route = createFileRoute("/_authed/_app/settings")({
	component: Settings,
});

function Settings() {
	return (
		<SettingsLayout>
			<Outlet />
		</SettingsLayout>
	);
}
