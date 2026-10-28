import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/ui/button";
import { cn } from "#/lib/cn";
import {
	SettingsCard,
	SettingsCardFooter,
	settingsActionClassName,
} from "./settings-card";

/**
 * Shown to a guest instead of the email and password forms (a guest has
 * neither): saving the account is the way to get them.
 */
export function SaveAccountCard() {
	const { t } = useTranslation("account");
	return (
		<SettingsCard
			title={t("saveAccount.title")}
			description={t("saveAccount.description")}
		>
			<SettingsCardFooter>
				<Button
					asChild
					className={cn("min-h-11 w-full", settingsActionClassName)}
				>
					<Link to="/signup" search={{ upgrade: 1 }}>
						{t("saveAccount.action")}
					</Link>
				</Button>
			</SettingsCardFooter>
		</SettingsCard>
	);
}
