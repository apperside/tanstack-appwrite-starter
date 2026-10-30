import { Link } from "@tanstack/react-router";
import { CompassIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "#/client/components/ui/button";
import { StatusPage } from "./status-page";

/** The router's default `notFoundComponent`. */
export function NotFound() {
	const { t } = useTranslation();
	return (
		<StatusPage
			icon={<CompassIcon />}
			title={t("notFound.title")}
			description={t("notFound.description")}
			action={
				<Button asChild variant="outline">
					<Link to="/">{t("notFound.home")}</Link>
				</Button>
			}
		/>
	);
}
