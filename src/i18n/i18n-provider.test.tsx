import { act, render, screen } from "@testing-library/react";
import { type ReactNode, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "./i18n-provider";
import type { Locale } from "./locale";

function Title() {
	const { t, i18n } = useTranslation("auth");
	return <h1 lang={i18n.language}>{t("login.title")}</h1>;
}

function Tree({ locale }: { locale: Locale }): ReactNode {
	return (
		<Suspense fallback="…">
			<I18nProvider locale={locale}>
				<Title />
			</I18nProvider>
		</Suspense>
	);
}

describe("I18nProvider", () => {
	it("renders translations for the given locale, suspending until loaded", async () => {
		await act(async () => render(<Tree locale="it" />));
		const heading = await screen.findByRole("heading", { name: "Accedi" });
		expect(heading).toHaveAttribute("lang", "it");
	});

	it("switches to a new instance when the locale changes", async () => {
		const { rerender } = await act(async () => render(<Tree locale="it" />));
		await screen.findByRole("heading", { name: "Accedi" });
		await act(async () => rerender(<Tree locale="en" />));
		expect(
			await screen.findByRole("heading", { name: "Sign in" }),
		).toHaveAttribute("lang", "en");
	});
});
