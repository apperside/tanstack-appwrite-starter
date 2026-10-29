import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { EmailLinkParams } from "#/core/auth/types";
import { useHydrated } from "#/hooks/use-hydrated";
import type { AppError } from "#/lib/errors";
import { emailLinkSearchSchema } from "../auth.schemas";

/**
 * Whether the server refused an emailed link itself (used, expired, or for a
 * user that no longer exists), as opposed to a failure worth retrying.
 */
export function isRejectedLink(error: AppError): boolean {
	return error.code === "INVALID_TOKEN" || error.code === "NOT_FOUND";
}

/** Where a captured link is kept in the history entry, for a reload. */
const EMAIL_LINK_STATE = "emailLink";

const hasParams = (link: EmailLinkParams) => Object.keys(link).length > 0;

/** A link kept in history state, if there is one. */
function readEmailLinkState(state: unknown): EmailLinkParams | undefined {
	if (typeof state !== "object" || state === null) return undefined;
	const parsed = emailLinkSearchSchema.parse(
		(state as Record<string, unknown>)[EMAIL_LINK_STATE],
	);
	return hasParams(parsed) ? parsed : undefined;
}

/**
 * The parameters of an emailed link (every search param of the page). Read
 * once from the URL, which then drops them (replacing the history entry): a
 * secret must not linger in the address bar or a `Referer`. The entry's
 * history state keeps them, so a reload still works. An empty object means no link.
 *
 * `null` means "not known yet": without a link in the URL, only the browser's
 * history state may hold one, and that is read once hydrated (the server and
 * the hydrating render cannot see it). Render a neutral placeholder meanwhile.
 */
export function useEmailLink(fromUrl: EmailLinkParams): EmailLinkParams | null {
	const navigate = useNavigate();
	const hydrated = useHydrated();
	const inUrl = hasParams(fromUrl);
	const [captured] = useState(inUrl ? fromUrl : undefined);
	const kept = useRouterState({
		select: (state) =>
			(state.location.state as unknown as Record<string, unknown>)[
				EMAIL_LINK_STATE
			],
	});
	const fromHistory = useMemo(
		() => readEmailLinkState({ [EMAIL_LINK_STATE]: kept }),
		[kept],
	);

	useEffect(() => {
		if (!captured) return;
		void navigate({
			to: ".",
			search: {},
			state: (previous) => ({ ...previous, [EMAIL_LINK_STATE]: captured }),
			replace: true,
		});
	}, [captured, navigate]);

	if (captured) return captured;
	if (fromHistory) return fromHistory;
	return hydrated ? {} : null;
}
