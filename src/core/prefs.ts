export type Locale = "en" | "it";

export type ThemePreference = "light" | "dark" | "system";

/**
 * The preferences stored with an account, whatever backend keeps them.
 * An interface so apps can extend it by declaration merging.
 */
export interface AppPrefs {
	onboardingCompleted: boolean;
	locale: Locale;
	theme: ThemePreference;
}

export const DEFAULT_PREFS: AppPrefs = {
	onboardingCompleted: false,
	locale: "en",
	theme: "system",
};
