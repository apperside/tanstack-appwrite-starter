import { useTranslation } from "react-i18next";
import { useQueryClient } from "tanstack-query-typed";
import {
	schemaValidators,
	useAppForm,
} from "#/client/components/form/form-kit";
import { toast } from "#/client/components/ui/toast";
import { useAuthMutation } from "#/client/features/auth/hooks/use-auth-mutation";
import { useCurrentUser } from "#/client/features/auth/hooks/use-current-user";
import { isGuest } from "#/lib/guards";
import {
	changeEmailSchema,
	changeNameSchema,
} from "#/lib/schemas/account.schemas";
import { NAME_MAX_LENGTH } from "#/lib/schemas/auth.schemas";
import { changeEmailMutation, changeNameMutation } from "../account.mutations";
import { sessionsQuery } from "../account.queries";
import { withAccountErrors } from "./account-errors";
import { SaveAccountCard } from "./save-account-card";
import {
	SettingsCard,
	SettingsCardBody,
	SettingsCardFooter,
	settingsActionClassName,
} from "./settings-card";

/** `/settings/profile`: name and email. A guest is offered to save the account instead. */
export function ProfileSettings() {
	const user = useCurrentUser();
	if (!user || isGuest(user)) return <SaveAccountCard />;
	return (
		<>
			<NameCard name={user.name} />
			<EmailCard email={user.email} />
		</>
	);
}

function NameCard({ name }: { name: string }) {
	const { t } = useTranslation("account");
	const change = useAuthMutation(changeNameMutation);
	const form = useAppForm({
		defaultValues: { name },
		validators: schemaValidators(changeNameSchema),
		onSubmit: async ({ value, formApi }) => {
			const next = changeNameSchema.parse(value);
			// A failure is the form error (`form.Form` shows what this throws).
			await change.mutateAsync(next);
			formApi.reset(next);
			toast.success(t("profile.name.saved"));
		},
	});

	return (
		<SettingsCard
			title={t("profile.name.title")}
			description={t("profile.name.description")}
		>
			<form.AppForm>
				<form.Form className="gap-0">
					<SettingsCardBody>
						<form.FormError />
						<form.AppField name="name">
							{(field) => (
								<field.TextField
									label={t("profile.name.label")}
									autoComplete="name"
								/>
							)}
						</form.AppField>
					</SettingsCardBody>
					<SettingsCardFooter
						hint={t("profile.name.hint", { maximum: NAME_MAX_LENGTH })}
					>
						<form.SubmitButton className={settingsActionClassName}>
							{t("profile.name.submit")}
						</form.SubmitButton>
					</SettingsCardFooter>
				</form.Form>
			</form.AppForm>
		</SettingsCard>
	);
}

function EmailCard({ email }: { email: string }) {
	const { t } = useTranslation("account");
	const queryClient = useQueryClient();
	const change = useAuthMutation({
		...changeEmailMutation,
		// Appwrite may end or renew sessions on a credential change.
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: sessionsQuery.queryKey }),
	});
	const form = useAppForm({
		defaultValues: { email: "", password: "" },
		validators: schemaValidators(changeEmailSchema),
		onSubmit: async ({ value, formApi }) => {
			const input = changeEmailSchema.parse(value);
			try {
				await change.mutateAsync(input);
			} catch (error) {
				withAccountErrors(
					formApi,
					error,
					{ currentPassword: "password", email: "email" },
					t("wrongPassword"),
				);
				return;
			}
			formApi.reset();
			toast.success(t("profile.email.saved", { email: input.email }));
		},
	});

	return (
		<SettingsCard
			title={t("profile.email.title")}
			description={t("profile.email.description", { email })}
		>
			<form.AppForm>
				<form.Form className="gap-0">
					<SettingsCardBody>
						<form.FormError />
						<form.AppField name="email">
							{(field) => (
								<field.TextField
									label={t("profile.email.label")}
									type="email"
									autoComplete="email"
								/>
							)}
						</form.AppField>
						<form.AppField name="password">
							{(field) => (
								<field.PasswordField
									label={t("profile.email.password")}
									autoComplete="current-password"
								/>
							)}
						</form.AppField>
					</SettingsCardBody>
					<SettingsCardFooter hint={t("profile.email.hint")}>
						<form.SubmitButton className={settingsActionClassName}>
							{t("profile.email.submit")}
						</form.SubmitButton>
					</SettingsCardFooter>
				</form.Form>
			</form.AppForm>
		</SettingsCard>
	);
}
