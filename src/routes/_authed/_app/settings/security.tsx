import { createFileRoute } from "@tanstack/react-router";
import { sessionsQuery } from "#/features/account/account.queries";
import { SecuritySettings } from "#/features/account/components/security-settings";
import { SettingsSectionSkeleton } from "#/features/account/components/settings-layout";

export const Route = createFileRoute("/_authed/_app/settings/security")({
	// The sessions render from the cache (`useSuspenseQuery`): fetched before the page.
	loader: ({ context }) => context.queryClient.ensureQueryData(sessionsQuery),
	pendingComponent: SettingsSectionSkeleton,
	component: SecuritySettings,
});
