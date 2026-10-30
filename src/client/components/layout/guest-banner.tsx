import { Link } from "@tanstack/react-router";
import { XIcon } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/client/components/ui/button";
import { useCurrentUser } from "#/client/features/auth/hooks/use-current-user";
import { writeSessionCookie } from "#/lib/cookies";
import { isGuest } from "#/lib/guards";
import {
	GUEST_BANNER_COOKIE,
	parseGuestBannerCookie,
} from "#/lib/guest-banner";

/** Invites a guest to save their account; dismissible for the browser session. */
export function GuestBanner({
	defaultDismissed,
}: {
	/** The `guest_banner_dismissed` cookie, read on the server: the first paint is final. */
	defaultDismissed: boolean;
}) {
	const { t } = useTranslation();
	const user = useCurrentUser();
	const messageId = useId();
	// The cookie also counts: the shell may remount with the loader's first
	// (cached) value from before a dismissal in this browser session.
	const [dismissed, setDismissed] = useState(
		() =>
			defaultDismissed ||
			(typeof document !== "undefined" &&
				parseGuestBannerCookie(document.cookie)),
	);

	if (!user || !isGuest(user) || dismissed) return null;

	return (
		<section
			aria-labelledby={messageId}
			className="bg-accent text-accent-foreground flex items-center gap-x-3 gap-y-2 border-b py-2 pr-2 pl-4 text-sm max-sm:flex-wrap md:pl-8"
		>
			<p id={messageId} className="min-w-0 flex-1 text-pretty">
				{t("guestBanner.message")}
			</p>
			<div className="flex shrink-0 items-center gap-1 max-sm:w-full max-sm:justify-between">
				<Button asChild size="sm">
					<Link to="/signup" search={{ upgrade: 1 }}>
						{t("guestBanner.action")}
					</Link>
				</Button>
				<Button
					variant="ghost"
					size="icon"
					className="size-8"
					onClick={() => {
						writeSessionCookie(GUEST_BANNER_COOKIE, "1");
						setDismissed(true);
					}}
				>
					<XIcon aria-hidden />
					<span className="sr-only">{t("guestBanner.dismiss")}</span>
				</Button>
			</div>
		</section>
	);
}
