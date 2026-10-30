import type { TFunction } from "i18next";
import { AppError } from "#/lib/errors";

/** The parts of a Standard Schema (zod) issue that pick the message. */
type Issue = {
	code?: unknown;
	origin?: unknown;
	format?: unknown;
	minimum?: unknown;
	maximum?: unknown;
};

/**
 * A field error in the user's language. Errors are data, not copy: a zod issue
 * maps to a `form.validation.*` key, an `AppError` (from `withServerErrors`) to
 * its `errors:*` key, and a string from a custom validator is shown as given
 * (it must already be translated).
 */
export function fieldErrorMessage(
	error: unknown,
	t: TFunction<["common", "errors"]>,
): string {
	if (error instanceof AppError) return t(error.i18nKey);
	if (typeof error === "string") return error;
	const issue: Issue = typeof error === "object" && error !== null ? error : {};
	const isText = issue.origin === "string";
	switch (issue.code) {
		case "invalid_format":
			return issue.format === "email"
				? t("form.validation.email")
				: t("form.validation.invalid");
		case "too_small":
			if (!isText) break;
			return Number(issue.minimum) <= 1
				? t("form.validation.required")
				: t("form.validation.tooShort", { minimum: issue.minimum });
		case "too_big":
			if (!isText) break;
			return t("form.validation.tooLong", { maximum: issue.maximum });
	}
	return t("form.validation.invalid");
}
