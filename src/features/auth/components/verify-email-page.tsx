import { Link } from "@tanstack/react-router";
import { Loader2Icon } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "tanstack-query-typed";
import { AuthLayout } from "#/components/layout/auth-layout";
import { PageSkeleton } from "#/components/layout/page-skeleton";
import { textLinkClassName } from "#/components/layout/text-link";
import { Button } from "#/components/ui/button";
import { toast } from "#/components/ui/toast";
import type { AppUser } from "#/lib/appwrite/app-models";
import { toAppError } from "#/lib/errors";
import { isGuest } from "#/lib/guards";
import {
	confirmVerificationMutation,
	sendVerificationMutation,
} from "../auth.mutations";
import { useAuthMutation } from "../use-auth-mutation";
import { useCurrentUser } from "../use-current-user";
import { useSignOut } from "../use-sign-out";
import { isRejectedLink, useEmailLink } from "./email-link";

type Props = { userId?: string; secret?: string };

/**
 * `/verify-email`. With a link (`userId` + `secret`) it confirms the email once,
 * signed in or not. Without one (the route guard ensures an unverified,
 * signed-in user) it asks to check the inbox and can send a new link.
 */
export function VerifyEmailPage(props: Props) {
	const link = useEmailLink(props);
	if (!link) return <PageSkeleton variant="form" />;
	const { userId, secret } = link;
	if (userId && secret) return <ConfirmEmail userId={userId} secret={secret} />;
	return <CheckInbox />;
}

function ConfirmEmail({ userId, secret }: Required<Props>) {
	const { t } = useTranslation(["auth", "common", "errors"]);
	const user = useCurrentUser();
	const confirm = useAuthMutation(confirmVerificationMutation);
	const { mutate } = confirm;

	// A link works once: confirm it once per link, also when StrictMode (or a
	// remount) runs this effect again.
	const confirmed = useRef<string | null>(null);
	useEffect(() => {
		const link = `${userId}:${secret}`;
		if (confirmed.current === link) return;
		confirmed.current = link;
		mutate({ userId, secret });
	}, [userId, secret, mutate]);

	if (confirm.isSuccess) {
		return (
			<Verified
				user={user}
				title={t("verify.verifiedTitle")}
				subtitle={t("verify.verifiedSubtitle")}
			/>
		);
	}

	if (confirm.isError) {
		const error = toAppError(confirm.error);
		// The signed-in user's own link, used before: there is nothing wrong.
		if (
			isRejectedLink(error) &&
			user?.$id === userId &&
			user.emailVerification
		) {
			return (
				<Verified
					user={user}
					title={t("verify.alreadyVerifiedTitle")}
					subtitle={t("verify.alreadyVerifiedSubtitle")}
				/>
			);
		}
		if (isRejectedLink(error)) {
			return (
				<AuthLayout
					focusTitle
					title={t("invalidLink.title")}
					subtitle={t("verify.invalidSubtitle")}
				>
					<NewLink user={user} />
				</AuthLayout>
			);
		}
		return (
			<AuthLayout
				focusTitle
				title={t("verify.errorTitle")}
				subtitle={t(error.i18nKey)}
			>
				<Button
					className="min-h-11 w-full"
					onClick={() => mutate({ userId, secret })}
				>
					{t("common:actions.retry")}
				</Button>
			</AuthLayout>
		);
	}

	return (
		<AuthLayout
			title={t("verify.confirmingTitle")}
			subtitle={t("verify.confirmingSubtitle")}
		>
			<div aria-hidden className="text-muted-foreground flex justify-center">
				<Loader2Icon className="size-6 animate-spin" />
			</div>
		</AuthLayout>
	);
}

function Verified({
	user,
	title,
	subtitle,
}: {
	user: AppUser | null;
	title: string;
	subtitle: string;
}) {
	const { t } = useTranslation("auth");
	return (
		<AuthLayout focusTitle title={title} subtitle={subtitle}>
			<Button asChild className="min-h-11 w-full">
				{user ? (
					<Link to="/">{t("verify.continue")}</Link>
				) : (
					<Link to="/login">{t("verify.signIn")}</Link>
				)}
			</Button>
		</AuthLayout>
	);
}

/** A new link goes to the signed-in user's email; anyone else signs in first. */
function NewLink({ user }: { user: AppUser | null }) {
	const { t } = useTranslation("auth");
	if (user && !isGuest(user)) return <ResendLink email={user.email} />;
	return (
		<Button asChild className="min-h-11 w-full">
			<Link to="/login" search={{ redirect: "/verify-email" }}>
				{t("verify.sendNew")}
			</Link>
		</Button>
	);
}

function CheckInbox() {
	const { t } = useTranslation("auth");
	const user = useCurrentUser();
	const signOut = useSignOut();
	const email = user?.email ?? "";

	return (
		<AuthLayout
			title={t("verify.inboxTitle")}
			subtitle={t("verify.inboxSubtitle", { email })}
			footer={
				<>
					{t("verify.wrongAccount")}{" "}
					<button
						type="button"
						className={textLinkClassName}
						disabled={signOut.isPending}
						onClick={() => signOut.mutate()}
					>
						{t("verify.signOut")}
					</button>
				</>
			}
		>
			<ResendLink email={email} variant="outline" />
		</AuthLayout>
	);
}

/** Sends a new verification link and says so in a polite live region. */
function ResendLink({
	email,
	variant = "default",
}: {
	email: string;
	variant?: "default" | "outline";
}) {
	const { t } = useTranslation(["auth", "errors"]);
	const send = useMutation({
		...sendVerificationMutation,
		onError: (error) => toast.error(t(toAppError(error).i18nKey)),
	});
	return (
		<div className="flex flex-col gap-3">
			<Button
				variant={variant}
				className="min-h-11 w-full"
				disabled={send.isPending}
				onClick={() => send.mutate()}
			>
				{send.isPending && <Loader2Icon aria-hidden className="animate-spin" />}
				{t("verify.sendNew")}
			</Button>
			<output
				// Always mounted so screen readers track it; empty takes no room.
				className="text-muted-foreground block text-center text-sm text-pretty empty:-mt-3"
			>
				{send.isSuccess && t("verify.sent", { email })}
			</output>
		</div>
	);
}
