import { createFileRoute } from "@tanstack/react-router";
import { PageSkeleton } from "#/components/layout/page-skeleton";
import { emailLinkSearchSchema } from "#/features/auth/auth.schemas";
import { ResetPasswordPage } from "#/features/auth/components/reset-password-page";

// Top-level and unguarded: a recovery link works whether or not anyone is signed in.
export const Route = createFileRoute("/reset-password")({
	validateSearch: emailLinkSearchSchema,
	pendingComponent: () => <PageSkeleton variant="form" />,
	component: ResetPassword,
});

function ResetPassword() {
	return <ResetPasswordPage link={Route.useSearch()} />;
}
