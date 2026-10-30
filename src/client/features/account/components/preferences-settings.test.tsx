import { act, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { type AppPrefs, DEFAULT_PREFS } from "#/core/prefs";
import { AppError } from "#/lib/errors";
import { updatePreferences } from "#/server/api/account/account.functions";
import { aGuest, aUser } from "#/test/fixtures";
import { renderWithRouter } from "#/test/router";
import { PreferencesSettings } from "./preferences-settings";

vi.mock("#/server/api/auth/auth.functions", () => ({
	getCurrentUser: vi.fn(),
}));
vi.mock("#/server/api/account/account.functions", () => ({
	updatePreferences: vi.fn(),
}));
const toastError = vi.hoisted(() => vi.fn());
vi.mock("#/client/components/ui/toast", () => ({
	toast: { success: vi.fn(), error: toastError },
}));

function renderPreferences(user = aUser()) {
	return renderWithRouter(<PreferencesSettings />, {
		path: "/settings/preferences",
		user,
	});
}

/** A save the test fails by hand, to look at the state while it is in flight. */
function failLater() {
	let fail: (error: unknown) => void = () => {};
	vi.mocked(updatePreferences).mockReturnValueOnce(
		new Promise<AppPrefs>((_, reject) => {
			fail = reject;
		}),
	);
	return (error: unknown) => act(async () => fail(error));
}

const cachedPrefs = (queryClient: {
	getQueryData: (key: string[]) => unknown;
}) => (queryClient.getQueryData(["currentUser"]) as { prefs: AppPrefs }).prefs;

describe("PreferencesSettings", () => {
	beforeEach(() => {
		vi.stubGlobal(
			"matchMedia",
			vi.fn(() => ({ matches: false, addEventListener: () => {} })),
		);
	});
	afterEach(() => {
		vi.clearAllMocks();
		vi.unstubAllGlobals();
		for (const name of ["theme", "locale"]) {
			// biome-ignore lint/suspicious/noDocumentCookie: expiring test cookies
			document.cookie = `${name}=; path=/; max-age=0`;
		}
		document.documentElement.className = "";
	});

	it("shows the current choices", async () => {
		await renderPreferences();
		expect(screen.getByRole("radio", { name: "English" })).toBeChecked();
		expect(screen.getByRole("radio", { name: "System" })).toBeChecked();
	});

	it("applies a theme at once, then rolls it back when saving fails", async () => {
		const fail = failLater();
		const { user, queryClient } = await renderPreferences();
		await user.click(screen.getByRole("radio", { name: "Dark" }));

		expect(cachedPrefs(queryClient).theme).toBe("dark");
		expect(document.documentElement).toHaveClass("dark");
		await waitFor(() =>
			expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked(),
		);
		expect(updatePreferences).toHaveBeenCalledWith({ data: { theme: "dark" } });

		await fail(new AppError("NETWORK"));
		expect(cachedPrefs(queryClient).theme).toBe("system");
		await waitFor(() =>
			expect(screen.getByRole("radio", { name: "System" })).toBeChecked(),
		);
		expect(document.documentElement).not.toHaveClass("dark");
		expect(toastError).toHaveBeenCalledWith(
			"Can't reach the server. Check your connection and try again.",
		);
	});

	it("switches the language at once and saves it (the server writes the cookie)", async () => {
		vi.mocked(updatePreferences).mockResolvedValue({
			...DEFAULT_PREFS,
			locale: "it",
		});
		const { user, queryClient } = await renderPreferences();
		await user.click(screen.getByRole("radio", { name: "Italiano" }));

		// The root route resolves the locale from these: the UI follows.
		expect(cachedPrefs(queryClient).locale).toBe("it");
		expect(document.cookie).not.toContain("locale=");
		await waitFor(() =>
			expect(updatePreferences).toHaveBeenCalledWith({
				data: { locale: "it" },
			}),
		);
	});

	it("rolls the language back when saving fails", async () => {
		const fail = failLater();
		const { user, queryClient } = await renderPreferences();
		await user.click(screen.getByRole("radio", { name: "Italiano" }));
		await fail(new AppError("NETWORK"));
		expect(cachedPrefs(queryClient).locale).toBe("en");
	});

	it("works for a guest", async () => {
		vi.mocked(updatePreferences).mockResolvedValue({
			...DEFAULT_PREFS,
			theme: "light",
		});
		const { user } = await renderPreferences(aGuest());
		await user.click(screen.getByRole("radio", { name: "Light" }));
		await waitFor(() =>
			expect(updatePreferences).toHaveBeenCalledWith({
				data: { theme: "light" },
			}),
		);
	});

	it("is accessible", async () => {
		const { container } = await renderPreferences();
		expect(await axe(container)).toHaveNoViolations();
	});
});
