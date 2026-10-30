import { createFileRoute } from "@tanstack/react-router";
import { PageSkeleton } from "#/client/components/layout/page-skeleton";
import { ResetPasswordPage } from "#/client/features/auth/components/reset-password-page";
import { emailLinkSearchSchema } from "#/lib/schemas/auth.schemas";

// Top-level and unguarded: a recovery link works whether or not anyone is signed in.
export const Route = createFileRoute("/reset-password")({
	validateSearch: emailLinkSearchSchema,
	pendingComponent: () => <PageSkeleton variant="form" />,
	component: ResetPassword,
});

function ResetPassword() {
	return <ResetPasswordPage link={Route.useSearch()} />;
}
