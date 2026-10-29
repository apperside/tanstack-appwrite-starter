import {
	Loader2Icon,
	type LucideIcon,
	MonitorIcon,
	MonitorSmartphoneIcon,
	SmartphoneIcon,
	TabletIcon,
} from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSuspenseQuery } from "tanstack-query-typed";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "#/components/ui/alert-dialog";
import { Button, buttonVariants } from "#/components/ui/button";
import type { DeviceSession } from "#/core/auth/types";
import { useSignOut } from "#/features/auth/use-sign-out";
import { useHydrated } from "#/hooks/use-hydrated";
import { cn } from "#/lib/cn";
import { sessionsQuery } from "../account.queries";
import {
	SettingsCard,
	SettingsCardBody,
	SettingsCardFooter,
	settingsActionClassName,
} from "./settings-card";

/** Appwrite's device types we name; any other shows the generic icon and no label. */
const DEVICES: Record<
	string,
	{ icon: LucideIcon; labelKey: "desktop" | "smartphone" | "tablet" }
> = {
	desktop: { icon: MonitorIcon, labelKey: "desktop" },
	smartphone: { icon: SmartphoneIcon, labelKey: "smartphone" },
	tablet: { icon: TabletIcon, labelKey: "tablet" },
};

/** The account's sessions (the route's loader prefetches them), current first. */
export function SessionsCard({
	canSignOutEverywhere,
}: {
	canSignOutEverywhere: boolean;
}) {
	const { t } = useTranslation("account");
	const { data: sessions } = useSuspenseQuery(sessionsQuery);
	const headingId = useId();
	return (
		<SettingsCard
			headingId={headingId}
			title={t("security.sessions.title")}
			description={t("security.sessions.description")}
		>
			<SettingsCardBody>
				<ul
					aria-labelledby={headingId}
					className="flex flex-col gap-3 sm:gap-0 sm:divide-y"
				>
					{sessions.map((session) => (
						<SessionItem key={session.id} session={session} />
					))}
				</ul>
			</SettingsCardBody>
			{canSignOutEverywhere && (
				<SettingsCardFooter hint={t("security.signOutEverywhere.hint")}>
					<SignOutEverywhere />
				</SettingsCardFooter>
			)}
		</SettingsCard>
	);
}

/** A card on phones, a row from `sm`: what signed in, from where, and when. */
function SessionItem({ session }: { session: DeviceSession }) {
	const { t, i18n } = useTranslation("account");
	const device = DEVICES[session.deviceName];
	const Icon = device?.icon ?? MonitorSmartphoneIcon;
	const client = session.clientName || t("security.sessions.unknownClient");
	// No location: Appwrite records the IP of whoever creates the session, and
	// that is the app server, not the visitor (only the user agent is forwarded).
	const kind = device && t(`security.sessions.device.${device.labelKey}`);
	const date = useSessionDate(session.createdAt, i18n.language);

	return (
		<li className="flex items-start gap-3 rounded-lg border p-3 sm:items-center sm:rounded-none sm:border-0 sm:px-0 sm:py-3 sm:first:pt-0 sm:last:pb-0">
			<span
				aria-hidden
				className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-md"
			>
				<Icon className="size-4" />
			</span>
			<div className="grid min-w-0 flex-1 gap-0.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-4">
				<p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
					{session.osName
						? t("security.sessions.clientOnOs", { client, os: session.osName })
						: client}
					{session.current && (
						<span className="bg-accent text-accent-foreground rounded-full px-2 py-0.5 text-xs font-medium">
							{t("security.sessions.current")}
						</span>
					)}
				</p>
				{kind && <p className="text-muted-foreground text-sm">{kind}</p>}
				<p className="text-muted-foreground text-sm sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:self-center sm:text-right">
					<time dateTime={session.createdAt}>
						{t("security.sessions.signedIn", { date })}
					</time>
				</p>
			</div>
		</li>
	);
}

/**
 * When a session started: its date on the server and while hydrating (in UTC,
 * so both render the same text), then date and time in the viewer's zone.
 */
function useSessionDate(iso: string, locale: string): string {
	const hydrated = useHydrated();
	return new Intl.DateTimeFormat(
		locale,
		hydrated
			? { dateStyle: "medium", timeStyle: "short" }
			: { dateStyle: "medium", timeZone: "UTC" },
	).format(new Date(iso));
}

/** "Sign out everywhere", confirmed first; the dialog stays up (busy) until it's done. */
function SignOutEverywhere() {
	const { t } = useTranslation(["account", "common"]);
	const [open, setOpen] = useState(false);
	const signOut = useSignOut({ everywhere: true });
	return (
		<AlertDialog
			open={open}
			onOpenChange={(next) => {
				if (!signOut.isPending) setOpen(next);
			}}
		>
			<AlertDialogTrigger asChild>
				<Button
					variant="outline"
					className={cn(
						"text-destructive hover:text-destructive w-full",
						settingsActionClassName,
					)}
				>
					{t("security.signOutEverywhere.action")}
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						{t("security.signOutEverywhere.title")}
					</AlertDialogTitle>
					<AlertDialogDescription>
						{t("security.signOutEverywhere.description")}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={signOut.isPending}>
						{t("common:actions.cancel")}
					</AlertDialogCancel>
					<AlertDialogAction
						className={buttonVariants({ variant: "destructive" })}
						disabled={signOut.isPending}
						onClick={(event) => {
							// Stay open while signing out; success leaves the page.
							event.preventDefault();
							signOut.mutate();
						}}
					>
						{signOut.isPending && (
							<Loader2Icon aria-hidden className="animate-spin" />
						)}
						{t("security.signOutEverywhere.confirm")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
