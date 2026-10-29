import { act, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { DEFAULT_PREFS } from "#/core/prefs";
import { updatePreferences } from "#/features/account/account.functions";
import { getCurrentUser, signOut } from "#/features/auth/auth.functions";
import { AppError } from "#/lib/errors";
import type { SidebarMode } from "#/lib/sidebar-state";
import { aGuest, aUser } from "#/test/fixtures";
import { renderWithRouter } from "#/test/router";
import { appNavigation } from "./app-navigation";
import { AppShell } from "./app-shell";

vi.mock("#/features/auth/auth.functions", () => ({
	getCurrentUser: vi.fn(),
	signOut: vi.fn(),
}));
vi.mock("#/features/account/account.functions", () => ({
	updatePreferences: vi.fn(),
}));

const viewport = vi.hoisted(() => ({ mobile: false, wide: true }));
vi.mock("#/hooks/use-mobile", () => ({ useIsMobile: () => viewport.mobile }));

function setViewport(width: "phone" | "tablet" | "desktop") {
	viewport.mobile = width === "phone";
	viewport.wide = width === "desktop";
	vi.stubGlobal(
		"matchMedia",
		vi.fn((query: string) => ({
			matches: query === "(min-width: 1024px)" && viewport.wide,
			addEventListener: () => {},
			removeEventListener: () => {},
		})),
	);
}

function clearCookies() {
	for (const name of ["sidebar_state", "theme"]) {
		// biome-ignore lint/suspicious/noDocumentCookie: expiring test cookies
		document.cookie = `${name}=; path=/; max-age=0`;
	}
}

function renderShell({
	mode = "auto",
	...options
}: { mode?: SidebarMode } & Parameters<typeof renderWithRouter>[1] = {}) {
	return renderWithRouter(
		<AppShell sidebarMode={mode}>
			<p>Page content</p>
		</AppShell>,
		{ user: aUser(), ...options },
	);
}

/** Keyboard path through the submenu (jsdom has no geometry for Radix's pointer grace area). */
async function chooseTheme(
	user: Awaited<ReturnType<typeof renderWithRouter>>["user"],
	label: string,
) {
	(await screen.findByRole("menuitem", { name: "Theme" })).focus();
	await user.keyboard("{ArrowRight}");
	const radio = await screen.findByRole("menuitemradio", { name: label });
	radio.focus();
	await user.keyboard("{Enter}");
}

const wrapper = () =>
	document.querySelector<HTMLElement>("[data-slot=sidebar-wrapper]");

describe("AppShell", () => {
	beforeEach(() => {
		setViewport("desktop");
		vi.mocked(getCurrentUser).mockResolvedValue(null);
		vi.mocked(signOut).mockResolvedValue(undefined);
		vi.mocked(updatePreferences).mockResolvedValue({
			...DEFAULT_PREFS,
			theme: "dark",
		});
	});
	afterEach(() => {
		vi.clearAllMocks();
		vi.unstubAllGlobals();
		clearCookies();
		document.documentElement.className = "";
	});

	it("renders every navigation item with its translated label", async () => {
		await renderShell({ locale: "it" });
		const nav = screen.getByRole("navigation", { name: "Principale" });
		expect(within(nav).getAllByRole("link")).toHaveLength(appNavigation.length);
		expect(within(nav).getByRole("link", { name: "Home" })).toHaveAttribute(
			"aria-current",
			"page",
		);
		expect(
			within(nav).getByRole("link", { name: "Impostazioni" }),
		).toHaveAttribute("href", "/settings");
		expect(screen.getByRole("main")).toHaveTextContent("Page content");
	});

	it("starts in the server-read mode, so CSS paints the right width first", async () => {
		await renderShell({ mode: "collapsed" });
		expect(wrapper()).toHaveAttribute("data-sidebar-mode", "collapsed");
	});

	it("on a phone, puts the navigation in a sheet opened from the header", async () => {
		setViewport("phone");
		const { user } = await renderShell();
		expect(screen.queryByRole("navigation")).not.toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Open navigation" }));
		const sheet = await screen.findByRole("dialog");
		const nav = within(sheet).getByRole("navigation", { name: "Main" });
		await user.click(within(nav).getByRole("link", { name: "Settings" }));
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
	});

	it("persists an explicit desktop toggle to the cookie", async () => {
		const { user } = await renderShell();
		const toggle = screen.getByRole("button", { name: "Toggle sidebar" });
		expect(toggle).toHaveAttribute("aria-expanded", "true");

		await user.click(toggle);
		expect(wrapper()).toHaveAttribute("data-sidebar-mode", "collapsed");
		expect(document.cookie).toContain("sidebar_state=collapsed");
		expect(toggle).toHaveAttribute("aria-expanded", "false");

		await user.keyboard("{Control>}b{/Control}");
		expect(wrapper()).toHaveAttribute("data-sidebar-mode", "expanded");
		expect(document.cookie).toContain("sidebar_state=expanded");
	});

	it("on a tablet, opens the full sidebar as a transient overlay", async () => {
		setViewport("tablet");
		const { user } = await renderShell();
		await user.click(screen.getByRole("button", { name: "Toggle sidebar" }));
		expect(wrapper()).toHaveAttribute("data-sidebar-overlay");
		expect(document.cookie).not.toContain("sidebar_state");

		await user.keyboard("{Escape}");
		expect(wrapper()).not.toHaveAttribute("data-sidebar-overlay");

		await user.click(screen.getByRole("button", { name: "Toggle sidebar" }));
		await user.click(screen.getByRole("button", { name: "Close sidebar" }));
		expect(wrapper()).not.toHaveAttribute("data-sidebar-overlay");
		// Focus returns to the control that opened it, not to <body>.
		expect(
			screen.getByRole("button", { name: "Toggle sidebar" }),
		).toHaveFocus();
	});

	it("on a tablet, Escape closes an open menu first, then the overlay", async () => {
		setViewport("tablet");
		const { user } = await renderShell();
		await user.click(screen.getByRole("button", { name: "Toggle sidebar" }));
		await user.click(screen.getByRole("button", { name: /Test User/ }));
		await screen.findByRole("menu");

		await user.keyboard("{Escape}");
		await waitFor(() =>
			expect(screen.queryByRole("menu")).not.toBeInTheDocument(),
		);
		expect(wrapper()).toHaveAttribute("data-sidebar-overlay");

		await user.keyboard("{Escape}");
		expect(wrapper()).not.toHaveAttribute("data-sidebar-overlay");
	});

	it("signs out once, then goes to /login", async () => {
		const { user, router } = await renderShell();
		await user.click(screen.getByRole("button", { name: /Test User/ }));
		await user.click(await screen.findByRole("menuitem", { name: "Sign out" }));

		await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
		expect(signOut).toHaveBeenCalledTimes(1);
	});

	it("shows a guest as Guest, with initials-free avatar", async () => {
		const { user } = await renderShell({ user: aGuest() });
		await user.click(screen.getByRole("button", { name: /Guest/ }));
		const menu = await screen.findByRole("menu");
		expect(within(menu).getByText("Account not saved yet")).toBeInTheDocument();
	});

	it("switches the theme optimistically and saves it", async () => {
		const { user, queryClient } = await renderShell();
		await user.click(screen.getByRole("button", { name: /Test User/ }));
		await chooseTheme(user, "Dark");

		expect(document.documentElement).toHaveClass("dark");
		// The server's response writes the cookie (R39), never the client.
		expect(document.cookie).not.toContain("theme=");
		await waitFor(() =>
			expect(updatePreferences).toHaveBeenCalledWith({
				data: { theme: "dark" },
			}),
		);
		await waitFor(() =>
			expect(queryClient.getQueryData(["currentUser"])).toMatchObject({
				prefs: { theme: "dark" },
			}),
		);
	});

	it("puts the previous theme back when saving fails", async () => {
		vi.mocked(updatePreferences).mockRejectedValue(new AppError("NETWORK"));
		const { user } = await renderShell({ theme: "light" });
		await user.click(screen.getByRole("button", { name: /Test User/ }));
		await chooseTheme(user, "Dark");

		await waitFor(() => expect(document.documentElement).toHaveClass("light"));
		expect(document.documentElement).not.toHaveClass("dark");
	});

	it("rolls back only when the latest theme change fails", async () => {
		let rejectFirst: (error: unknown) => void = () => {};
		vi.mocked(updatePreferences)
			.mockImplementationOnce(
				() =>
					new Promise((_, reject) => {
						rejectFirst = reject;
					}),
			)
			.mockResolvedValueOnce({ ...DEFAULT_PREFS, theme: "light" });
		const { user } = await renderShell({ theme: "system" });
		await user.click(screen.getByRole("button", { name: /Test User/ }));
		await chooseTheme(user, "Dark");
		await user.click(screen.getByRole("button", { name: /Test User/ }));
		await chooseTheme(user, "Light");
		await waitFor(() => expect(updatePreferences).toHaveBeenCalledTimes(2));

		// The stale "dark" save fails after "light" was chosen: keep "light".
		await act(async () => rejectFirst(new AppError("NETWORK")));
		expect(document.documentElement).toHaveClass("light");
	});

	it("is accessible on desktop and with the phone sheet open", async () => {
		const desktop = await renderShell();
		expect(await axe(desktop.container)).toHaveNoViolations();
		desktop.unmount();

		setViewport("phone");
		const phone = await renderShell();
		await act(() =>
			phone.user.click(screen.getByRole("button", { name: "Open navigation" })),
		);
		await screen.findByRole("dialog");
		expect(await axe(document.body)).toHaveNoViolations();
	});
});
