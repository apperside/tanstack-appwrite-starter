import { act, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { updatePreferences } from "#/features/account/account.functions";
import { type AppPrefs, DEFAULT_PREFS } from "#/lib/appwrite/app-models";
import { aUser } from "#/test/fixtures";
import { renderWithRouter } from "#/test/router";
import { useThemePreference } from "./use-preference";

vi.mock("#/features/auth/auth.functions", () => ({ getCurrentUser: vi.fn() }));
vi.mock("#/features/account/account.functions", () => ({
	updatePreferences: vi.fn(),
}));
vi.mock("#/components/ui/toast", () => ({ toast: { error: vi.fn() } }));

function ThemeButtons() {
	const [theme, setTheme] = useThemePreference();
	return (
		<>
			<p>Theme: {theme}</p>
			<button type="button" onClick={() => setTheme("dark")}>
				Dark
			</button>
			<button type="button" onClick={() => setTheme("light")}>
				Light
			</button>
		</>
	);
}

/** A promise the test settles by hand. */
function deferred<T>() {
	let resolve: (value: T) => void = () => {};
	let reject: (error: unknown) => void = () => {};
	const promise = new Promise<T>((done, fail) => {
		resolve = done;
		reject = fail;
	});
	return { promise, resolve, reject };
}

describe("useThemePreference", () => {
	beforeEach(() => {
		vi.stubGlobal(
			"matchMedia",
			vi.fn(() => ({ matches: false, addEventListener: () => {} })),
		);
	});
	afterEach(() => {
		vi.clearAllMocks();
		vi.unstubAllGlobals();
		// biome-ignore lint/suspicious/noDocumentCookie: expiring the test cookie
		document.cookie = "theme=; path=/; max-age=0";
		document.documentElement.className = "";
	});

	it("applies a choice at once but leaves the cookie to the server (R39)", async () => {
		vi.mocked(updatePreferences).mockResolvedValue({ theme: "dark" });
		const { user, queryClient } = await renderWithRouter(<ThemeButtons />, {
			user: aUser(),
		});

		await user.click(screen.getByRole("button", { name: "Dark" }));

		expect(document.documentElement).toHaveClass("dark");
		expect(queryClient.getQueryData(["currentUser"])).toMatchObject({
			prefs: { theme: "dark" },
		});
		await waitFor(() => expect(updatePreferences).toHaveBeenCalled());
		expect(document.cookie).not.toContain("theme=");
	});

	it("keeps the latest choice in the cache when saves resolve out of order", async () => {
		const first = deferred<AppPrefs>();
		const second = deferred<AppPrefs>();
		vi.mocked(updatePreferences)
			.mockReturnValueOnce(first.promise)
			.mockReturnValueOnce(second.promise);
		const { user, queryClient } = await renderWithRouter(<ThemeButtons />, {
			user: aUser(),
		});

		await user.click(screen.getByRole("button", { name: "Dark" }));
		await user.click(screen.getByRole("button", { name: "Light" }));
		await waitFor(() => expect(updatePreferences).toHaveBeenCalledTimes(2));

		await act(async () => second.resolve({ ...DEFAULT_PREFS, theme: "light" }));
		// The stale "dark" save answers last: it must not win.
		await act(async () => first.resolve({ ...DEFAULT_PREFS, theme: "dark" }));

		expect(queryClient.getQueryData(["currentUser"])).toMatchObject({
			prefs: { theme: "light" },
		});
		expect(document.documentElement).toHaveClass("light");
	});

	it("rolls back to the last saved choice, not the one on screen when the failing change began", async () => {
		const failing = deferred<AppPrefs>();
		vi.mocked(updatePreferences)
			.mockResolvedValueOnce({ ...DEFAULT_PREFS, theme: "dark" })
			.mockReturnValueOnce(failing.promise);
		const { user, queryClient } = await renderWithRouter(<ThemeButtons />, {
			user: aUser(),
		});

		await user.click(screen.getByRole("button", { name: "Dark" }));
		await waitFor(() =>
			expect(queryClient.getQueryData(["currentUser"])).toMatchObject({
				prefs: { theme: "dark" },
			}),
		);
		await user.click(screen.getByRole("button", { name: "Light" }));
		await act(async () => failing.reject(new Error("NETWORK")));

		expect(queryClient.getQueryData(["currentUser"])).toMatchObject({
			prefs: { theme: "dark" },
		});
		expect(document.documentElement).toHaveClass("dark");
		expect(screen.getByText("Theme: dark")).toBeInTheDocument();
	});
});
