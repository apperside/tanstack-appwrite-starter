import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "tanstack-query-typed";
import { z } from "zod/mini";
import {
	schemaValidators,
	useAppForm,
	withServerErrors,
} from "#/components/form/form-kit";
import { AuthLayout } from "#/components/layout/auth-layout";
import { PageSkeleton } from "#/components/layout/page-skeleton";
import { Button } from "#/components/ui/button";
import { toast } from "#/components/ui/toast";
import { toAppError } from "#/lib/errors";
import { AUTH_FIELD_ERRORS, resetPasswordMutation } from "../auth.mutations";
import { resetPasswordSchema } from "../auth.schemas";
import { isRejectedLink, useEmailLink } from "./email-link";

const newPasswordSchema = z.pick(resetPasswordSchema, { password: true });

type Props = { userId?: string; secret?: string };

/**
 * `/reset-password`: the target of the recovery email. A missing, malformed,
 * used or expired link shows the "invalid link" state with a way to get a new one.
 */
export function ResetPasswordPage(props: Props) {
	const link = useEmailLink(props);
	const [rejected, setRejected] = useState(false);
	if (!link) return <PageSkeleton variant="form" />;
	const { userId, secret } = link;
	if (!userId || !secret || rejected) {
		return <InvalidResetLink focusTitle={rejected} />;
	}
	return (
		<ResetPasswordForm
			userId={userId}
			secret={secret}
			onRejected={() => setRejected(true)}
		/>
	);
}

function InvalidResetLink({ focusTitle }: { focusTitle: boolean }) {
	const { t } = useTranslation("auth");
	return (
		<AuthLayout
			focusTitle={focusTitle}
			title={t("invalidLink.title")}
			subtitle={t("reset.invalidSubtitle")}
		>
			<Button asChild className="min-h-11 w-full">
				<Link to="/forgot-password">{t("reset.requestNew")}</Link>
			</Button>
		</AuthLayout>
	);
}

function ResetPasswordForm({
	userId,
	secret,
	onRejected,
}: Required<Props> & { onRejected: () => void }) {
	const { t } = useTranslation("auth");
	const navigate = useNavigate();
	const reset = useMutation(resetPasswordMutation);
	const form = useAppForm({
		defaultValues: { password: "" },
		validators: schemaValidators(newPasswordSchema),
		onSubmit: async ({ value, formApi }) => {
			try {
				await reset.mutateAsync({ userId, secret, ...value });
			} catch (error) {
				if (isRejectedLink(toAppError(error))) onRejected();
				else withServerErrors(formApi, error, AUTH_FIELD_ERRORS);
				return;
			}
			toast.success(t("reset.done"));
			await navigate({ to: "/login" });
		},
	});

	return (
		<AuthLayout title={t("reset.title")} subtitle={t("reset.subtitle")}>
			<form.AppForm>
				<form.Form>
					<form.FormError />
					<form.AppField name="password">
						{(field) => (
							<field.PasswordField
								label={t("fields.newPassword")}
								autoComplete="new-password"
								showStrength
							/>
						)}
					</form.AppField>
					<form.SubmitButton>{t("reset.submit")}</form.SubmitButton>
				</form.Form>
			</form.AppForm>
		</AuthLayout>
	);
}
