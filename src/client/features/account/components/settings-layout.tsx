import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { pageClassName } from "#/client/components/layout/page";
import { Skeleton } from "#/client/components/ui/skeleton";
import { cn } from "#/lib/cn";

const SECTIONS = [
	{ to: "/settings/profile", labelKey: "settings.tabs.profile" },
	{ to: "/settings/security", labelKey: "settings.tabs.security" },
	{ to: "/settings/preferences", labelKey: "settings.tabs.preferences" },
] as const;

/** A narrower column than other pages: settings are forms, not data. */
const settingsPageClassName = cn(pageClassName, "max-w-3xl");

/**
 * `/settings`: the title and the sections as tabs. They are links to child
 * routes, so each section has its own URL (deep links, back button).
 */
export function SettingsLayout({ children }: { children: ReactNode }) {
	const { t } = useTranslation("account");
	return (
		<div className={settingsPageClassName}>
			<header className="flex flex-col gap-1">
				<h1 className="text-2xl font-semibold tracking-tight">
					{t("settings.title")}
				</h1>
				<p className="text-muted-foreground text-sm text-pretty">
					{t("settings.subtitle")}
				</p>
			</header>
			<nav
				aria-label={t("settings.tabs.label")}
				className="-mx-4 overflow-x-auto border-b px-4 md:mx-0 md:px-0"
			>
				<ul className="-mb-px flex gap-1">
					{SECTIONS.map(({ to, labelKey }) => (
						<li key={to}>
							<Link
								to={to}
								className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/70 aria-[current=page]:border-foreground aria-[current=page]:text-foreground inline-flex min-h-10 items-center rounded-t-md border-b-2 border-transparent px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-inset pointer-coarse:min-h-11"
							>
								{t(labelKey)}
							</Link>
						</li>
					))}
				</ul>
			</nav>
			<div className="flex flex-col gap-6">{children}</div>
		</div>
	);
}

/** Stands in for a section while its data loads (inside the layout, under the tabs). */
export function SettingsSectionSkeleton() {
	return (
		<div className="flex flex-col gap-4 rounded-xl border p-4 sm:p-6">
			<Skeleton className="h-5 w-32" />
			<Skeleton className="h-4 w-64 max-w-full" />
			{[0, 1].map((row) => (
				<div key={row} className="flex items-center gap-3 pt-2">
					<Skeleton className="size-9 shrink-0 rounded-md" />
					<Skeleton className="h-4 w-1/2" />
				</div>
			))}
		</div>
	);
}
