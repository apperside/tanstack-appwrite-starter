import { useSelector } from "@tanstack/react-form";
import { type ChangeEvent, type ReactNode, useId } from "react";
import { useTranslation } from "react-i18next";
import { Label } from "#/client/components/ui/label";
import { fieldErrorMessage } from "./field-error";
import { useFieldContext } from "./form-context";

/**
 * State and ARIA wiring shared by every text-like field.
 * Errors stay hidden until the field is blurred (or the form submitted); from
 * then on, while the field has an error, each change revalidates so it clears
 * as soon as it is fixed ("reward early, punish late").
 */
export function useFieldControl({ description }: { description?: string }) {
	const field = useFieldContext<string>();
	const { t } = useTranslation(["common", "errors"]);
	const id = useId();
	const meta = useSelector(field.store, (state) => state.meta);
	const submitted = useSelector(
		field.form.store,
		(state) => state.submissionAttempts > 0,
	);

	const [firstError] = meta.errors;
	const showError = (meta.isBlurred || submitted) && firstError !== undefined;
	const ids = {
		input: `${id}-input`,
		description: `${id}-description`,
		error: `${id}-error`,
	};
	const describedBy = [
		description ? ids.description : undefined,
		showError ? ids.error : undefined,
	]
		.filter(Boolean)
		.join(" ");

	return {
		ids,
		error: showError ? fieldErrorMessage(firstError, t) : undefined,
		value: field.state.value,
		inputProps: {
			id: ids.input,
			name: field.name,
			value: field.state.value,
			onBlur: () => {
				// TanStack clears the form's onServer error after any error-free
				// validation, blur included; only an edit or a new submission should.
				const serverError = field.form.state.errorMap.onServer;
				field.handleBlur();
				if (serverError && !field.form.state.errorMap.onServer) {
					field.form.setErrorMap({ onServer: serverError });
				}
			},
			onChange: (event: ChangeEvent<HTMLInputElement>) => {
				field.handleChange(event.target.value);
				// A server error answered the submitted value, so any edit makes it stale
				// (TanStack only drops the form's one when no other field is invalid).
				if (field.form.state.errorMap.onServer) {
					field.form.setErrorMap({ onServer: undefined });
				}
				if (meta.errorMap.onServer) field.setErrorMap({ onServer: undefined });
				// Also refreshes hidden errors: a form-level blur validates every
				// field, and a stale error would block an Enter-to-submit.
				if (firstError !== undefined) field.validate("blur");
			},
			"aria-invalid": showError || undefined,
			"aria-describedby": describedBy || undefined,
		},
	};
}

/** Label, control, optional description and a polite live region for the error. */
export function FieldShell({
	ids,
	label,
	description,
	error,
	children,
}: {
	ids: ReturnType<typeof useFieldControl>["ids"];
	label: string;
	description?: string;
	error?: string;
	children: ReactNode;
}) {
	return (
		<div className="grid gap-2">
			<Label htmlFor={ids.input}>{label}</Label>
			{children}
			{description && (
				<p id={ids.description} className="text-muted-foreground text-sm">
					{description}
				</p>
			)}
			{/* Always mounted so screen readers track it; empty takes no room. */}
			<p
				id={ids.error}
				aria-live="polite"
				className="text-destructive text-sm empty:-mt-2"
			>
				{error}
			</p>
		</div>
	);
}
