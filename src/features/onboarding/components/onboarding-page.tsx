import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { schemaValidators, useAppForm } from "#/components/form/form-kit";
import { AuthLayout } from "#/components/layout/auth-layout";
import { useAuthMutation } from "#/features/auth/use-auth-mutation";
import { useCurrentUser } from "#/features/auth/use-current-user";
import { completeOnboardingMutation } from "../onboarding.mutations";
import { onboardingFormSchema } from "../onboarding.schemas";

/**
 * `/onboarding`: the generic first step (a name) before the app. Apps add
 * their own steps here.
 */
export function OnboardingPage() {
	const { t } = useTranslation("onboarding");
	const navigate = useNavigate();
	const user = useCurrentUser();
	const complete = useAuthMutation(completeOnboardingMutation);
	const form = useAppForm({
		defaultValues: { name: user?.name ?? "" },
		validators: schemaValidators(onboardingFormSchema),
		onSubmit: async ({ value }) => {
			const name = value.name.trim();
			// Errors surface as the form error (`form.Form` catches them).
			await complete.mutateAsync(name ? { name } : {});
			await navigate({ to: "/" });
		},
	});

	return (
		<AuthLayout title={t("title")} subtitle={t("subtitle")}>
			<form.AppForm>
				<form.Form>
					<form.FormError />
					<form.AppField name="name">
						{(field) => (
							<field.TextField
								label={t("name")}
								description={t("nameHint")}
								autoComplete="name"
							/>
						)}
					</form.AppField>
					<form.SubmitButton>{t("submit")}</form.SubmitButton>
				</form.Form>
			</form.AppForm>
		</AuthLayout>
	);
}
