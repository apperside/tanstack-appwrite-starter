import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoginPage } from "#/client/features/auth/components/login-page";
import { isGuest } from "#/lib/guards";
import { loginSearchSchema } from "#/lib/schemas/auth.schemas";

export const Route = createFileRoute("/_public/login")({
	validateSearch: loginSearchSchema,
	beforeLoad: ({ context, search }) => {
		// A guest signing in always keeps their work: make that mode explicit.
		if (context.user && isGuest(context.user) && search.merge !== 1) {
			throw redirect({ to: "/login", search: { ...search, merge: 1 } });
		}
	},
	component: Login,
});

function Login() {
	const { redirect, merge } = Route.useSearch();
	return <LoginPage redirect={redirect} merge={merge === 1} />;
}
