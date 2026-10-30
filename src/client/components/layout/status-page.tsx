import type { ReactNode } from "react";
import { cn } from "#/lib/cn";
import { MainLandmark } from "./main-landmark";

type Props = {
	icon: ReactNode;
	title: string;
	description: string;
	action: ReactNode;
	tone?: "muted" | "destructive";
	/** `alert` announces the description (only it: not the title or the action). */
	role?: "alert";
};

/**
 * A centred full-state message (error, not found). It fills the space it is
 * given: the viewport at the root (as the page's `<main>`), the content column
 * inside the app shell (which already is the `<main>`).
 */
export function StatusPage({
	icon,
	title,
	description,
	action,
	tone = "muted",
	role,
}: Props) {
	return (
		<MainLandmark className="mx-auto flex min-h-[min(36rem,100svh)] w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 py-12 text-center">
			<div
				aria-hidden
				className={cn(
					"grid size-12 place-items-center rounded-full [&_svg]:size-6",
					tone === "destructive"
						? "bg-destructive/10 text-destructive"
						: "bg-muted text-muted-foreground",
				)}
			>
				{icon}
			</div>
			<div className="flex flex-col gap-2">
				<h1 className="text-xl font-semibold tracking-tight text-balance">
					{title}
				</h1>
				<p role={role} className="text-muted-foreground text-sm text-pretty">
					{description}
				</p>
			</div>
			{action}
		</MainLandmark>
	);
}
