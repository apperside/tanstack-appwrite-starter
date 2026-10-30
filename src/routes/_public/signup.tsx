import { createFileRoute, redirect } from "@tanstack/react-router";
import { SignupPage } from "#/client/features/auth/components/signup-page";
import { isGuest } from "#/lib/guards";
import { signupSearchSchema } from "#/lib/schemas/auth.schemas";

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
