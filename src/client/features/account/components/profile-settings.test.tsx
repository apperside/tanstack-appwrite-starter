import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { AppError } from "#/lib/errors";
import {
	changeEmail,
	changeName,
} from "#/server/api/account/account.functions";
import { getCurrentUser } from "#/server/api/auth/auth.functions";
import { aGuest, aUser } from "#/test/fixtures";
import { renderWithRouter } from "#/test/router";
import { ProfileSettings } from "./profile-settings";

vi.mock("#/server/api/auth/auth.functions", () => ({
	getCurrentUser: vi.fn(),
}));
vi.mock("#/server/api/account/account.functions", () => ({
	changeName: vi.fn(),
	changeEmail: vi.fn(),
}));
const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock("#/client/components/ui/toast", () => ({
	toast: { success: toastSuccess, error: vi.fn() },
}));

function renderProfile(user = aUser({ name: "Ada Lovelace" })) {
	return renderWithRouter(<ProfileSettings />, {
		path: "/settings/profile",
		user,
	});
}

const section = (name: string) => screen.getByRole("region", { name });

describe("ProfileSettings", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(changeName).mockResolvedValue({ ok: true });
		vi.mocked(changeEmail).mockResolvedValue({ ok: true });
	});

	it("renames the user, refreshes them and confirms", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(aUser({ name: "Ada King" }));
		const { user, queryClient } = await renderProfile();
		const name = within(section("Name")).getByLabelText("Full name");
		expect(name).toHaveValue("Ada Lovelace");

		await user.clear(name);
		await user.type(name, "  Ada King ");
		await user.click(screen.getByRole("button", { name: "Save name" }));

		await waitFor(() =>
			expect(toastSuccess).toHaveBeenCalledWith("Name updated"),
		);
		expect(changeName).toHaveBeenCalledWith({ data: { name: "Ada King" } });
		expect(queryClient.getQueryData(["currentUser"])).toMatchObject({
			name: "Ada King",
		});
		expect(name).toHaveValue("Ada King");
	});

	it("changes the email with the current password, then clears the form", async () => {
		const { user, queryClient } = await renderProfile();
		queryClient.setQueryData(["sessions"], []);
		const email = section("Email");
		expect(email).toHaveTextContent("user@example.test");

		await user.type(
			within(email).getByLabelText("New email"),
			"new@example.test",
		);
		await user.type(
			within(email).getByLabelText("Current password"),
			"pw-123456",
		);
		await user.click(screen.getByRole("button", { name: "Change email" }));

		await waitFor(() =>
			expect(toastSuccess).toHaveBeenCalledWith(
				"Email updated. Check new@example.test for a verification link.",
			),
		);
		expect(changeEmail).toHaveBeenCalledWith({
			data: { email: "new@example.test", password: "pw-123456" },
		});
		expect(within(email).getByLabelText("New email")).toHaveValue("");
		expect(within(email).getByLabelText("Current password")).toHaveValue("");
		expect(queryClient.getQueryState(["sessions"])?.isInvalidated).toBe(true);
	});

	it("puts a wrong current password, and a taken email, on their fields", async () => {
		vi.mocked(changeEmail)
			.mockRejectedValueOnce(new AppError("INVALID_CREDENTIALS"))
			.mockRejectedValueOnce(new AppError("EMAIL_TAKEN"));
		const { user } = await renderProfile();
		const email = section("Email");
		const password = within(email).getByLabelText("Current password");
		await user.type(
			within(email).getByLabelText("New email"),
			"new@example.test",
		);
		await user.type(password, "wrong-password");
		await user.click(screen.getByRole("button", { name: "Change email" }));

		await waitFor(() =>
			expect(password).toHaveAccessibleDescription(
				"That password isn't right. Check it and try again.",
			),
		);

		// Editing the password clears its error; the next answer is about the email.
		await user.type(password, "-fixed");
		await user.click(screen.getByRole("button", { name: "Change email" }));
		await waitFor(() =>
			expect(
				within(email).getByLabelText("New email"),
			).toHaveAccessibleDescription(/already exists/),
		);
		expect(toastSuccess).not.toHaveBeenCalled();
	});

	it("offers a guest to save the account instead of the profile forms (Review Focus 3)", async () => {
		await renderProfile(aGuest());
		expect(
			screen.getByRole("heading", { name: "Save your account" }),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Save account" })).toHaveAttribute(
			"href",
			"/signup?upgrade=1",
		);
		expect(screen.queryByLabelText("Current password")).not.toBeInTheDocument();
		expect(screen.queryByLabelText("New email")).not.toBeInTheDocument();
		expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
	});

	it("is accessible, for a user and for a guest", async () => {
		const registered = await renderProfile();
		expect(await axe(registered.container)).toHaveNoViolations();
		registered.unmount();
		const guest = await renderProfile(aGuest());
		expect(await axe(guest.container)).toHaveNoViolations();
	});
});
