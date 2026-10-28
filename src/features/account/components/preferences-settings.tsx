import { useId } from "react";
import { useTranslation } from "react-i18next";
import { LOCALES } from "#/i18n/locale";
import { THEME_OPTIONS } from "../theme-options";
import { useLocalePreference, useThemePreference } from "../use-preference";
import { ChoiceGroup } from "./choice-group";
import { SettingsCard, SettingsCardBody } from "./settings-card";

/** `/settings/preferences`: language and theme, saved (optimistically) on change. Guests too. */
export function PreferencesSettings() {
	return (
		<>
			<LanguageCard />
			<ThemeCard />
		</>
	);
}

function LanguageCard() {
	const { t } = useTranslation(["account", "common"]);
	const [locale, setLocale] = useLocalePreference();
	const headingId = useId();
	return (
		<SettingsCard
			headingId={headingId}
			title={t("preferences.language.title")}
			description={t("preferences.language.description")}
		>
			<SettingsCardBody>
				<ChoiceGroup
					labelledBy={headingId}
					value={locale}
					onChange={setLocale}
					choices={LOCALES.map((value) => ({
						value,
						label: t(`common:language.${value}`),
						lang: value,
					}))}
				/>
			</SettingsCardBody>
		</SettingsCard>
	);
}

function ThemeCard() {
	const { t } = useTranslation(["account", "common"]);
	const [theme, setTheme] = useThemePreference();
	const headingId = useId();
	return (
		<SettingsCard
			headingId={headingId}
			title={t("preferences.theme.title")}
			description={t("preferences.theme.description")}
		>
			<SettingsCardBody>
				<ChoiceGroup
					labelledBy={headingId}
					value={theme}
					onChange={setTheme}
					choices={THEME_OPTIONS.map(({ value, icon }) => ({
						value,
						icon,
						label: t(`common:theme.${value}`),
					}))}
				/>
			</SettingsCardBody>
		</SettingsCard>
	);
}
