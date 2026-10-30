import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { aGuest, aUser } from "#/test/fixtures";
import { renderWithRouter } from "#/test/router";
import { GuestBanner } from "./guest-banner";

const MESSAGE = /You're using a guest account/;

function clearCookie() {
	// biome-ignore lint/suspicious/noDocumentCookie: expiring the test cookie
	document.cookie = "guest_banner_dismissed=; path=/; max-age=0";
}

describe("GuestBanner", () => {
	afterEach(clearCookie);

	it("invites a guest to save the account", async () => {
		const { container } = await renderWithRouter(
			<GuestBanner defaultDismissed={false} />,
			{ user: aGuest() },
		);
		expect(screen.getByText(MESSAGE)).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Save account" })).toHaveAttribute(
			"href",
			"/signup?upgrade=1",
		);
		expect(await axe(container)).toHaveNoViolations();
	});

	it("renders nothing for a registered user", async () => {
		await renderWithRouter(<GuestBanner defaultDismissed={false} />, {
			user: aUser(),
		});
		expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument();
	});

	it("renders nothing from the first paint when the server read a dismissal", async () => {
		await renderWithRouter(<GuestBanner defaultDismissed />, {
			user: aGuest(),
		});
		expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument();
	});

	it("stays dismissed when remounted with the stale server value (cached loader data)", async () => {
		// biome-ignore lint/suspicious/noDocumentCookie: the dismissal written earlier in this browser session
		document.cookie = "guest_banner_dismissed=1; path=/";
		await renderWithRouter(<GuestBanner defaultDismissed={false} />, {
			user: aGuest(),
		});
		expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument();
	});

	it("remembers a dismissal in a session cookie the server can read", async () => {
		const { user } = await renderWithRouter(
			<GuestBanner defaultDismissed={false} />,
			{ user: aGuest() },
		);
		await user.click(screen.getByRole("button", { name: "Dismiss" }));
		expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument();
		expect(document.cookie).toContain("guest_banner_dismissed=1");
	});
});
