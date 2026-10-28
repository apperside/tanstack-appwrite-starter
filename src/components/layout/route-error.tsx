import { type ErrorComponentProps, useRouter } from "@tanstack/react-router";
import { RotateCwIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/ui/button";
import { toAppError } from "#/lib/errors";
import { StatusPage } from "./status-page";

/**
 * The router's default `errorComponent`: the translated message of the
 * normalized error (never the raw one) and a retry that re-runs the loaders.
 */
export function RouteError({ error }: ErrorComponentProps) {
	const { t } = useTranslation(["common", "errors"]);
	const router = useRouter();
	return (
		<StatusPage
			role="alert"
			tone="destructive"
			icon={<TriangleAlertIcon />}
			title={t("errorPage.title")}
			description={t(toAppError(error).i18nKey)}
			action={
				<Button onClick={() => router.invalidate()}>
					<RotateCwIcon aria-hidden />
					{t("actions.retry")}
				</Button>
			}
		/>
	);
}
