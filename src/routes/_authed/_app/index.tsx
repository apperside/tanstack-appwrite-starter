import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { pageClassName } from "#/components/layout/page";
import { Card, CardDescription, CardHeader } from "#/components/ui/card";
import { useCurrentUser } from "#/features/auth/use-current-user";

export const Route = createFileRoute("/_authed/_app/")({ component: Home });

// Placeholder home: apps replace it with their dashboard.
function Home() {
	const { t } = useTranslation();
	const name = useCurrentUser()?.name;
	return (
		<div className={pageClassName}>
			<Card>
				<CardHeader>
					<h1 className="text-2xl font-semibold tracking-tight text-balance">
						{name ? t("home.welcome", { name }) : t("home.welcomeAnonymous")}
					</h1>
					<CardDescription className="text-pretty">
						{t("home.intro")}
					</CardDescription>
				</CardHeader>
			</Card>
		</div>
	);
}
