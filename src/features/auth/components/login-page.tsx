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
import { sanitizeRedirect } from "#/lib/redirect";
import {
	AUTH_FIELD_ERRORS,
	signInAndMergeGuestMutation,
	signInMutation,
} from "../auth.mutations";
import { signInSchema } from "../auth.schemas";
import { useAuthMutation } from "../use-auth-mutation";
import { useCurrentUser } from "../use-current-user";
import { GuestAccess } from "./guest-access";

type Props = {
	/** Where to go once signed in; sanitized, so only same-origin paths survive. */
	redirect?: string;
	/** `merge=1`: a guest signs in to an existing account and keeps their work. */
	merge?: boolean;
};

/** `/login`: email + password, recovery and sign-up links, and guest access. */
export function LoginPage({ redirect, merge = false }: Props) {
	const { t } = useTranslation("auth");
	const user = useCurrentUser();
	const mergeGuest = merge && user !== null && isGuest(user);

	return (
		<AuthPanel
			title={t(mergeGuest ? "login.mergeTitle" : "login.title")}
			subtitle={t(mergeGuest ? "login.mergeSubtitle" : "login.subtitle")}
			footer={
				mergeGuest ? (
					<>
						{t("login.newHere")}{" "}
						<Link
							to="/signup"
							search={{ upgrade: 1 }}
							className={textLinkClassName}
						>
							{t("login.saveGuest")}
						</Link>
					</>
				) : (
					<>
						{t("login.noAccount")}{" "}
						<Link to="/signup" className={textLinkClassName}>
							{t("login.signUp")}
						</Link>
					</>
				)
			}
		>
			<LoginForm redirect={redirect} mergeGuest={mergeGuest} />
			{!mergeGuest && <GuestAccess />}
		</AuthPanel>
	);
}

function LoginForm({
	redirect,
	mergeGuest,
}: {
	redirect?: string;
	mergeGuest: boolean;
}) {
	const { t } = useTranslation("auth");
	const navigate = useNavigate();
	const signIn = useAuthMutation(
		mergeGuest ? signInAndMergeGuestMutation : signInMutation,
	);
	const form = useAppForm({
		defaultValues: { email: "", password: "" },
		validators: schemaValidators(signInSchema),
		onSubmit: async ({ value, formApi }) => {
			try {
				await signIn.mutateAsync(value);
			} catch (error) {
				withServerErrors(formApi, error, AUTH_FIELD_ERRORS);
				return;
			}
			await navigate({ href: sanitizeRedirect(redirect) });
		},
	});

	return (
		<form.AppForm>
			<form.Form>
				<form.FormError />
				<form.AppField name="email">
					{(field) => (
						<field.TextField
							label={t("fields.email")}
							type="email"
							autoComplete="email"
						/>
					)}
				</form.AppField>
				<div className="grid gap-1">
					<form.AppField name="password">
						{(field) => (
							<field.PasswordField
								label={t("fields.password")}
								autoComplete="current-password"
							/>
						)}
					</form.AppField>
					<Link
						to="/forgot-password"
						className={`${standaloneTextLinkClassName} text-muted-foreground hover:text-foreground justify-self-end text-sm font-normal`}
					>
						{t("login.forgotPassword")}
					</Link>
				</div>
				<form.SubmitButton>{t("login.submit")}</form.SubmitButton>
			</form.Form>
		</form.AppForm>
	);
}
