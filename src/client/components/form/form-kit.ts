import { createFormHook } from "@tanstack/react-form";
import { Form } from "./form";
import { fieldContext, formContext } from "./form-context";
import { FormError } from "./form-error";
import { PasswordField } from "./password-field";
import { SubmitButton } from "./submit-button";
import { TextField } from "./text-field";

/**
 * The app's form hook. Fields: `field.TextField`, `field.PasswordField`.
 * Form: `form.Form`, `form.SubmitButton`, `form.FormError` (inside `form.AppForm`).
 */
export const { useAppForm } = createFormHook({
	fieldContext,
	formContext,
	fieldComponents: { TextField, PasswordField },
	formComponents: { Form, SubmitButton, FormError },
});

/**
 * Validators for a form-level schema: on blur (errors appear once a field is
 * left) and on submit (the whole form, including untouched fields).
 */
export function schemaValidators<TSchema>(schema: TSchema) {
	return { onBlur: schema, onSubmit: schema };
}

export { withServerErrors } from "./server-errors";
