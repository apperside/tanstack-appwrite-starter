import { createFileRoute, redirect } from "@tanstack/react-router";
import { signupSearchSchema } from "#/features/auth/auth.schemas";
import { SignupPage } from "#/features/auth/components/signup-page";
import { isGuest } from "#/lib/guards";

export const Route = createFileRoute("/_public/signup")({
	validateSearch: signupSearchSchema,
	beforeLoad: ({ context, search }) => {
		// A guest signing up saves the guest account: make that mode explicit.
		if (context.user && isGuest(context.user) && search.upgrade !== 1) {
			throw redirect({ to: "/signup", search: { upgrade: 1 } });
		}
	},
	component: Signup,
});

function Signup() {
	const { upgrade } = Route.useSearch();
	return <SignupPage upgrade={upgrade === 1} />;
}
