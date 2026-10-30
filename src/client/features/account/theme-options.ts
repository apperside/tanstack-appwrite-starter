import { type LucideIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import type { ThemePreference } from "#/core/prefs";

/** The theme choices, in display order: the user menu and the preferences page. */
export const THEME_OPTIONS: { value: ThemePreference; icon: LucideIcon }[] = [
	{ value: "light", icon: SunIcon },
	{ value: "dark", icon: MoonIcon },
	{ value: "system", icon: MonitorIcon },
];

export function isThemePreference(value: string): value is ThemePreference {
	return THEME_OPTIONS.some((theme) => theme.value === value);
}
