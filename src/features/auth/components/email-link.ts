import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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

type EmailLink = { userId?: string; secret?: string };

/** Where a captured link is kept in the history entry, for a reload. */
const EMAIL_LINK_STATE = "emailLink";

/** A link kept in history state, if it is a well-formed one. */
function readEmailLinkState(state: unknown): EmailLink | undefined {
	if (typeof state !== "object" || state === null) return undefined;
	const parsed = emailLinkSearchSchema.safeParse(
		(state as Record<string, unknown>)[EMAIL_LINK_STATE],
	);
	return parsed.success && parsed.data.userId && parsed.data.secret
		? parsed.data
		: undefined;
}

/**
 * The credentials of an emailed link. Read once from the URL, which then drops
 * them (replacing the history entry): a secret must not linger in the address
 * bar or a `Referer`. The entry's history state keeps them, so a reload still
 * works. Other search params are kept.
 *
 * `null` means "not known yet": without a link in the URL, only the browser's
 * history state may hold one, and that is read once hydrated (the server and
 * the hydrating render cannot see it). Render a neutral placeholder meanwhile.
 */
export function useEmailLink(fromUrl: EmailLink): EmailLink | null {
	const navigate = useNavigate();
	const hydrated = useHydrated();
	const inUrl = fromUrl.userId !== undefined || fromUrl.secret !== undefined;
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
			search: (previous: Record<string, unknown>) => ({
				...previous,
				userId: undefined,
				secret: undefined,
			}),
			state: (previous) => ({ ...previous, [EMAIL_LINK_STATE]: captured }),
			replace: true,
		});
	}, [captured, navigate]);

	if (captured) return captured;
	if (fromHistory) return fromHistory;
	return hydrated ? {} : null;
}
