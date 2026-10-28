import { useStore } from "@tanstack/react-form";
import { CircleAlertIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "#/components/ui/alert";
import { toAppError } from "#/lib/errors";
import { useFormContext } from "./form-context";

/**
 * The form-level error of the last submission, translated, in an alert.
 * It lives under `errorMap.onServer` (set by `withServerErrors`), because a
 * form-level schema also writes its field issues to `errorMap.onSubmit`.
 */
export function FormError() {
	const form = useFormContext();
	const error = useStore(form.store, (state) => state.errorMap.onServer);
	const { t } = useTranslation(["common", "errors"]);
	if (!error) return null;
	return (
		<Alert variant="destructive">
			<CircleAlertIcon aria-hidden />
			<AlertDescription>{t(toAppError(error).i18nKey)}</AlertDescription>
		</Alert>
	);
}
