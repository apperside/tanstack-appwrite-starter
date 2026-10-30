import { createFileRoute } from "@tanstack/react-router";
import { ForgotPasswordPage } from "#/client/features/auth/components/forgot-password-page";

export const Route = createFileRoute("/_public/forgot-password")({
	component: ForgotPasswordPage,
});
