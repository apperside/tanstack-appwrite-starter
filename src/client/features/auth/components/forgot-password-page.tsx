import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "tanstack-query-typed";
import {
	schemaValidators,
	useAppForm,
	withServerErrors,
} from "#/client/components/form/form-kit";
import { AuthPanel } from "#/client/components/layout/auth-layout";
import { textLinkClassName } from "#/client/components/layout/text-link";
import { Button } from "#/client/components/ui/button";
import { requestResetSchema } from "#/lib/schemas/auth.schemas";
import {
	AUTH_FIELD_ERRORS,
	requestPasswordResetMutation,
} from "../auth.mutations";

/**
 * `/forgot-password`: asks for a reset link. The confirmation never says
 * whether the account exists (the server answers the same either way).
 */
export function ForgotPasswordPage() {
	const { t } = useTranslation("auth");
	const [sentTo, setSentTo] = useState<string | null>(null);

	if (sentTo !== null) {
		return (
			<AuthPanel
				focusTitle
				title={t("forgot.sentTitle")}
				subtitle={t("forgot.sentSubtitle", { email: sentTo })}
			>
				<div className="flex flex-col gap-2">
					<Button asChild className="min-h-11 w-full">
						<Link to="/login">{t("forgot.backToSignIn")}</Link>
					</Button>
					<Button
						variant="ghost"
						className="min-h-11 w-full"
						onClick={() => setSentTo(null)}
					>
						{t("forgot.otherEmail")}
					</Button>
				</div>
			</AuthPanel>
		);
	}

	return (
		<AuthPanel
			title={t("forgot.title")}
			subtitle={t("forgot.subtitle")}
			footer={
				<>
					{t("forgot.remembered")}{" "}
					<Link to="/login" className={textLinkClassName}>
						{t("forgot.signIn")}
					</Link>
				</>
			}
		>
			<ForgotPasswordForm onSent={setSentTo} />
		</AuthPanel>
	);
}

function ForgotPasswordForm({ onSent }: { onSent: (email: string) => void }) {
	const { t } = useTranslation("auth");
	const request = useMutation(requestPasswordResetMutation);
	const form = useAppForm({
		defaultValues: { email: "" },
		validators: schemaValidators(requestResetSchema),
		onSubmit: async ({ value, formApi }) => {
			try {
				await request.mutateAsync(value);
			} catch (error) {
				withServerErrors(formApi, error, AUTH_FIELD_ERRORS);
				return;
			}
			onSent(value.email.trim());
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
				<form.SubmitButton>{t("forgot.submit")}</form.SubmitButton>
			</form.Form>
		</form.AppForm>
	);
}
