import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { renderWithRouter } from "#/test/router";
import { SettingsLayout } from "./settings-layout";

vi.mock("#/server/api/auth/auth.functions", async (importOriginal) => ({
	...(await importOriginal<
		typeof import("#/server/api/auth/auth.functions")
	>()),
	getCurrentUser: vi.fn(),
}));

describe("SettingsLayout", () => {
	it("links every section, marking the current one", async () => {
		const { container } = await renderWithRouter(
			<SettingsLayout>
				<p>Section content</p>
			</SettingsLayout>,
			{ path: "/settings/security", locale: "it" },
		);
		expect(
			screen.getByRole("heading", { level: 1, name: "Impostazioni" }),
		).toBeInTheDocument();
		const nav = screen.getByRole("navigation", {
			name: "Sezioni delle impostazioni",
		});
		const links = within(nav).getAllByRole("link");
		expect(links.map((link) => link.getAttribute("href"))).toEqual([
			"/settings/profile",
			"/settings/security",
			"/settings/preferences",
		]);
		expect(
			within(nav).getByRole("link", { name: "Sicurezza" }),
		).toHaveAttribute("aria-current", "page");
		expect(
			within(nav).getByRole("link", { name: "Profilo" }),
		).not.toHaveAttribute("aria-current");
		expect(screen.getByText("Section content")).toBeInTheDocument();
		expect(await axe(container)).toHaveNoViolations();
	});
});
