import type { AnyFormApi } from "@tanstack/react-form";
import { type AppErrorCode, toAppError } from "#/lib/errors";

/**
 * Shows a failed submission's error: on the field mapped to its code (e.g.
 * `EMAIL_TAKEN` → `email`), otherwise as the form error that `FormError` renders.
 * Both live under `onServer`, which validation never touches: a field's error
 * survives blur and is cleared by its next change (see `useFieldControl`), and
 * every new submission starts by clearing them all (see `Form`).
 */
export function withServerErrors(
	form: AnyFormApi,
	error: unknown,
	fieldForCode: Partial<Record<AppErrorCode, string>> = {},
): void {
	const appError = toAppError(error);
	const field = fieldForCode[appError.code];
	if (field !== undefined && form.getFieldMeta(field)) {
		form.setFieldMeta(field, (meta) => ({
			...meta,
			errorMap: { ...meta.errorMap, onServer: appError },
		}));
		return;
	}
	form.setErrorMap({ onServer: appError });
}
