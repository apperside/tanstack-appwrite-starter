import type { AnyFormApi } from "@tanstack/react-form";
import { withServerErrors } from "#/client/components/form/form-kit";
import { toAppError } from "#/lib/errors";

/**
 * A failed account form submission. A wrong current password goes on that
 * field, as `wrongPassword` (the generic message speaks of an email too);
 * a taken email or a weak new password on theirs; the rest is a form error.
 */
export function withAccountErrors(
	form: AnyFormApi,
	error: unknown,
	fields: { currentPassword: string; email?: string; newPassword?: string },
	wrongPassword: string,
): void {
	if (toAppError(error).code === "INVALID_CREDENTIALS") {
		form.setFieldMeta(fields.currentPassword, (meta) => ({
			...meta,
			errorMap: { ...meta.errorMap, onServer: wrongPassword },
		}));
		return;
	}
	withServerErrors(form, error, {
		EMAIL_TAKEN: fields.email,
		WEAK_PASSWORD: fields.newPassword,
	});
}
