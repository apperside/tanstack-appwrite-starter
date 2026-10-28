import { useTranslation } from "react-i18next";
import { useQueryClient } from "tanstack-query-typed";
import { schemaValidators, useAppForm } from "#/components/form/form-kit";
import { toast } from "#/components/ui/toast";
import { useAuthMutation } from "#/features/auth/use-auth-mutation";
import { useCurrentUser } from "#/features/auth/use-current-user";
import { isGuest } from "#/lib/guards";
import { changePasswordMutation } from "../account.mutations";
import { sessionsQuery } from "../account.queries";
import { changePasswordSchema } from "../account.schemas";
import { withAccountErrors } from "./account-errors";
import { SaveAccountCard } from "./save-account-card";
import { SessionsCard } from "./sessions-card";
import {
	SettingsCard,
	SettingsCardBody,
	SettingsCardFooter,
	settingsActionClassName,
} from "./settings-card";

/**
 * `/settings/security`: password and sessions. A guest is offered to save the
 * account instead of the password form, and cannot sign out everywhere (that
 * would lose the unsaved account).
 */
export function SecuritySettings() {
	const user = useCurrentUser();
	const registered = user !== null && !isGuest(user);
	return (
		<>
			{registered ? <PasswordCard email={user.email} /> : <SaveAccountCard />}
			<SessionsCard canSignOutEverywhere={registered} />
		</>
	);
}

function PasswordCard({ email }: { email: string }) {
	const { t } = useTranslation("account");
	const queryClient = useQueryClient();
	const change = useAuthMutation({
		...changePasswordMutation,
		// Appwrite may end or renew sessions on a credential change.
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: sessionsQuery.queryKey }),
	});
	const form = useAppForm({
		defaultValues: { currentPassword: "", newPassword: "" },
		validators: schemaValidators(changePasswordSchema),
		onSubmit: async ({ value, formApi }) => {
			try {
				await change.mutateAsync(value);
			} catch (error) {
				withAccountErrors(
					formApi,
					error,
					{ currentPassword: "currentPassword", newPassword: "newPassword" },
					t("wrongPassword"),
				);
				return;
			}
			formApi.reset();
			toast.success(t("security.password.saved"));
		},
	});

	return (
		<SettingsCard
			title={t("security.password.title")}
			description={t("security.password.description")}
		>
			<form.AppForm>
				<form.Form className="gap-0">
					{/* Tells password managers whose password this is. */}
					<input
						type="email"
						name="username"
						autoComplete="username"
						value={email}
						readOnly
						hidden
					/>
					<SettingsCardBody>
						<form.FormError />
						<form.AppField name="currentPassword">
							{(field) => (
								<field.PasswordField
									label={t("security.password.current")}
									autoComplete="current-password"
								/>
							)}
						</form.AppField>
						<form.AppField name="newPassword">
							{(field) => (
								<field.PasswordField
									label={t("security.password.new")}
									autoComplete="new-password"
									showStrength
								/>
							)}
						</form.AppField>
					</SettingsCardBody>
					<SettingsCardFooter hint={t("security.password.hint")}>
						<form.SubmitButton className={settingsActionClassName}>
							{t("security.password.submit")}
						</form.SubmitButton>
					</SettingsCardFooter>
				</form.Form>
			</form.AppForm>
		</SettingsCard>
	);
}
