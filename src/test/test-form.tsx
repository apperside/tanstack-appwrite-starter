import { z } from "zod/mini";
import {
	schemaValidators,
	useAppForm,
	withServerErrors,
} from "#/components/form/form-kit";
import { emailSchema, passwordSchema } from "#/features/auth/auth.schemas";
import type { AppErrorCode } from "#/lib/errors";

const schema = z.object({ email: emailSchema, password: passwordSchema });

/** A tiny email + password form exercising the whole kit. */
export function TestForm({
	onSubmit = async () => {},
	fieldForCode,
	showStrength = false,
	catchErrors = true,
}: {
	onSubmit?: (value: z.input<typeof schema>) => Promise<void>;
	fieldForCode?: Partial<Record<AppErrorCode, string>>;
	showStrength?: boolean;
	/** `false` lets errors escape `onSubmit`, as a consumer without field mapping would. */
	catchErrors?: boolean;
}) {
	const form = useAppForm({
		defaultValues: { email: "", password: "" },
		validators: schemaValidators(schema),
		onSubmit: async ({ value, formApi }) => {
			if (!catchErrors) return onSubmit(value);
			try {
				await onSubmit(value);
			} catch (error) {
				withServerErrors(formApi, error, fieldForCode);
			}
		},
	});
	return (
		<form.AppForm>
			<form.Form aria-label="Test form">
				<form.FormError />
				<form.AppField name="email">
					{(field) => (
						<field.TextField
							label="Email"
							type="email"
							autoComplete="email"
							description="We never share it."
						/>
					)}
				</form.AppField>
				<form.AppField name="password">
					{(field) => (
						<field.PasswordField
							label="Password"
							autoComplete="new-password"
							showStrength={showStrength}
						/>
					)}
				</form.AppField>
				<form.SubmitButton>Submit</form.SubmitButton>
			</form.Form>
		</form.AppForm>
	);
}
