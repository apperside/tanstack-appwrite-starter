import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import type { DeviceSession } from "#/core/auth/types";
import { AppError } from "#/lib/errors";
import {
	changePassword,
	listSessions,
} from "#/server/api/account/account.functions";
import {
	getCurrentUser,
	signOutEverywhere,
} from "#/server/api/auth/auth.functions";
import { aGuest, aUser } from "#/test/fixtures";
import { renderWithRouter } from "#/test/router";
import { SecuritySettings } from "./security-settings";

vi.mock("#/server/api/auth/auth.functions", () => ({
	getCurrentUser: vi.fn(),
	signOutEverywhere: vi.fn(),
}));
vi.mock("#/server/api/account/account.functions", () => ({
	changePassword: vi.fn(),
	listSessions: vi.fn(),
}));
const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock("#/client/components/ui/toast", () => ({
	toast: { success: toastSuccess, error: vi.fn() },
}));

function aSessionInfo(overrides: Partial<DeviceSession> = {}): DeviceSession {
	return {
		id: "s-1",
		current: false,
		clientName: "Firefox",
		osName: "Windows",
		deviceName: "desktop",
		createdAt: "2026-03-01T10:00:00.000+00:00",
		...overrides,
	};
}

const SESSIONS = [
	aSessionInfo({
		id: "this",
		current: true,
		clientName: "Chrome",
		osName: "macOS",
	}),
	aSessionInfo({
		id: "phone",
		clientName: "Safari",
		osName: "iOS",
		deviceName: "smartphone",
	}),
];

async function renderSecurity(user = aUser()) {
	const rendered = await renderWithRouter(<SecuritySettings />, {
		path: "/settings/security",
		user,
	});
	await screen.findByRole("list", { name: "Sessions" });
	return rendered;
}

describe("SecuritySettings", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(listSessions).mockResolvedValue(SESSIONS);
		vi.mocked(changePassword).mockResolvedValue({ ok: true });
		vi.mocked(signOutEverywhere).mockResolvedValue(undefined);
		vi.mocked(getCurrentUser).mockResolvedValue(aUser());
	});

	it("lists the sessions and marks the current one", async () => {
		await renderSecurity();
		const items = within(
			screen.getByRole("list", { name: "Sessions" }),
		).getAllByRole("listitem");
		expect(items).toHaveLength(2);
		expect(items[0]).toHaveTextContent("Chrome on macOS");
		expect(items[0]).toHaveTextContent("This device");
		expect(items[1]).toHaveTextContent("Safari on iOS");
		expect(items[1]).toHaveTextContent("Phone");
		// Sessions are created by the server: the IP (so the place) is its own.
		expect(screen.queryByText(/Germany|Italy/)).not.toBeInTheDocument();
		expect(items[1]).not.toHaveTextContent("This device");
	});

	it("shows when each session started, in the viewer's time zone", async () => {
		await renderSecurity();
		const [first] = within(
			screen.getByRole("list", { name: "Sessions" }),
		).getAllByRole("listitem");
		const local = new Intl.DateTimeFormat("en", {
			dateStyle: "medium",
			timeStyle: "short",
		}).format(new Date(SESSIONS[0].createdAt));
		expect(first).toHaveTextContent(`Signed in ${local}`);
	});

	it("changes the password, confirms and clears the form", async () => {
		const { user } = await renderSecurity();
		const current = screen.getByLabelText("Current password");
		await user.type(current, "old-password");
		await user.type(screen.getByLabelText("New password"), "a much longer one");
		await user.click(screen.getByRole("button", { name: "Update password" }));

		await waitFor(() =>
			expect(toastSuccess).toHaveBeenCalledWith("Password updated"),
		);
		expect(changePassword).toHaveBeenCalledWith({
			data: {
				currentPassword: "old-password",
				newPassword: "a much longer one",
			},
		});
		expect(current).toHaveValue("");
		// The sessions may have changed with the password: read them again.
		await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(2));
	});

	it("puts a wrong current password on its field", async () => {
		vi.mocked(changePassword).mockRejectedValue(
			new AppError("INVALID_CREDENTIALS"),
		);
		const { user } = await renderSecurity();
		const current = screen.getByLabelText("Current password");
		await user.type(current, "nope-nope");
		await user.type(screen.getByLabelText("New password"), "a much longer one");
		await user.click(screen.getByRole("button", { name: "Update password" }));
		await waitFor(() =>
			expect(current).toHaveAccessibleDescription(/password isn't right/),
		);
	});

	it("signs out everywhere only once confirmed, then goes to sign in", async () => {
		const { user, router } = await renderSecurity();
		await user.click(
			screen.getByRole("button", { name: "Sign out everywhere" }),
		);
		let dialog = await screen.findByRole("alertdialog");
		expect(dialog).toHaveAccessibleName("Sign out everywhere?");
		expect(signOutEverywhere).not.toHaveBeenCalled();

		await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
		await waitFor(() =>
			expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
		);
		expect(signOutEverywhere).not.toHaveBeenCalled();

		await user.click(
			screen.getByRole("button", { name: "Sign out everywhere" }),
		);
		dialog = await screen.findByRole("alertdialog");
		await user.click(
			within(dialog).getByRole("button", { name: "Sign out everywhere" }),
		);
		await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
		expect(signOutEverywhere).toHaveBeenCalledTimes(1);
	});

	it("offers a guest to save the account instead of the password form (Review Focus 3)", async () => {
		vi.mocked(listSessions).mockResolvedValue([SESSIONS[0]]);
		await renderSecurity(aGuest());
		expect(screen.getByRole("link", { name: "Save account" })).toHaveAttribute(
			"href",
			"/signup?upgrade=1",
		);
		expect(screen.queryByLabelText("Current password")).not.toBeInTheDocument();
		expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
		// Signing a guest out everywhere would lose the unsaved account.
		expect(
			screen.queryByRole("button", { name: "Sign out everywhere" }),
		).not.toBeInTheDocument();
	});

	it("is accessible, with the confirmation open too", async () => {
		const { container, user } = await renderSecurity();
		expect(await axe(container)).toHaveNoViolations();
		await user.click(
			screen.getByRole("button", { name: "Sign out everywhere" }),
		);
		await screen.findByRole("alertdialog");
		expect(await axe(document.body)).toHaveNoViolations();
	});
});
