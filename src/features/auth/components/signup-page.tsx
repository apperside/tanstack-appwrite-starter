import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
	schemaValidators,
	useAppForm,
	withServerErrors,
} from "#/components/form/form-kit";
import { AuthPanel } from "#/components/layout/auth-layout";
import {
	standaloneTextLinkClassName,
	textLinkClassName,
} from "#/components/layout/text-link";
import { isGuest } from "#/lib/guards";
import {
	AUTH_FIELD_ERRORS,
	signUpMutation,
	upgradeGuestMutation,
} from "../auth.mutations";
import { signUpSchema } from "../auth.schemas";
import { useAuthMutation } from "../use-auth-mutation";
import { useCurrentUser } from "../use-current-user";

type Props = {
	/** `upgrade=1`: a guest saves their account in place (same id, work kept). */
	upgrade?: boolean;
};

/** `/signup`: a new account, or (for a guest with `upgrade=1`) saving the guest one. */
export function SignupPage({ upgrade = false }: Props) {
	const { t } = useTranslation("auth");
	const user = useCurrentUser();
	const upgradeGuest = upgrade && user !== null && isGuest(user);

	return (
		<AuthPanel
			title={t(upgradeGuest ? "signup.upgradeTitle" : "signup.title")}
			subtitle={t(upgradeGuest ? "signup.upgradeSubtitle" : "signup.subtitle")}
			footer={
				upgradeGuest ? (
					<Link
						to="/login"
						search={{ merge: 1 }}
						className={standaloneTextLinkClassName}
					>
						{t("signup.existingAccount")}
					</Link>
				) : (
					<>
						{t("signup.haveAccount")}{" "}
						<Link to="/login" className={textLinkClassName}>
							{t("signup.signIn")}
						</Link>
					</>
				)
			}
		>
			<SignupForm upgradeGuest={upgradeGuest} />
		</AuthPanel>
	);
}

function SignupForm({ upgradeGuest }: { upgradeGuest: boolean }) {
	const { t } = useTranslation("auth");
	const navigate = useNavigate();
	const signUp = useAuthMutation(
		upgradeGuest ? upgradeGuestMutation : signUpMutation,
	);
	const form = useAppForm({
		defaultValues: { name: "", email: "", password: "" },
		validators: schemaValidators(signUpSchema),
		onSubmit: async ({ value, formApi }) => {
			try {
				await signUp.mutateAsync(value);
			} catch (error) {
				withServerErrors(formApi, error, AUTH_FIELD_ERRORS);
				return;
			}
			// A saved guest already went through onboarding; a new account has not.
			await navigate({ to: upgradeGuest ? "/" : "/onboarding" });
		},
	});

	return (
		<form.AppForm>
			<form.Form>
				<form.FormError />
				<form.AppField name="name">
					{(field) => (
						<field.TextField label={t("fields.name")} autoComplete="name" />
					)}
				</form.AppField>
				<form.AppField name="email">
					{(field) => (
						<field.TextField
							label={t("fields.email")}
							type="email"
							autoComplete="email"
						/>
					)}
				</form.AppField>
				<form.AppField name="password">
					{(field) => (
						<field.PasswordField
							label={t("fields.password")}
							autoComplete="new-password"
							showStrength
						/>
					)}
				</form.AppField>
				<form.SubmitButton>
					{t(upgradeGuest ? "signup.upgradeSubmit" : "signup.submit")}
				</form.SubmitButton>
			</form.Form>
		</form.AppForm>
	);
}
