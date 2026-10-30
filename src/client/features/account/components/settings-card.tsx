import { type ComponentProps, type ReactNode, useId } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
} from "#/client/components/ui/card";
import { cn } from "#/lib/cn";

/**
 * A settings section: a card whose heading names the region. Children are its
 * `SettingsCardBody` and optional `SettingsCardFooter` (both inside a form
 * when it has one).
 */
export function SettingsCard({
	title,
	description,
	headingId,
	children,
}: {
	title: string;
	description: ReactNode;
	/** For a control the heading also labels (a radio group, a list). */
	headingId?: string;
	children: ReactNode;
}) {
	const generatedId = useId();
	const id = headingId ?? generatedId;
	return (
		<section aria-labelledby={id}>
			<Card className="gap-0 overflow-hidden">
				<CardHeader className="gap-1.5 px-4 pb-6 sm:px-6">
					<h2 id={id} className="text-base leading-tight font-semibold">
						{title}
					</h2>
					<CardDescription className="text-sm text-pretty">
						{description}
					</CardDescription>
				</CardHeader>
				{children}
			</Card>
		</section>
	);
}

export function SettingsCardBody({
	className,
	...props
}: ComponentProps<typeof CardContent>) {
	return (
		<CardContent
			className={cn("grid gap-4 px-4 pb-6 sm:px-6", className)}
			{...props}
		/>
	);
}

/** The card's action bar: a hint on the left, the action on the right (stacked on phones). */
export function SettingsCardFooter({
	hint,
	children,
}: {
	hint?: string;
	children: ReactNode;
}) {
	return (
		<CardFooter className="bg-muted/50 flex-col items-stretch gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 [.border-t]:pt-3">
			{hint && (
				<p className="text-muted-foreground text-sm text-pretty">{hint}</p>
			)}
			<div className="flex flex-col sm:ml-auto sm:flex-row">{children}</div>
		</CardFooter>
	);
}

/** The footer button's size: full width on phones, compact from `sm` (44px on touch). */
export const settingsActionClassName = "sm:w-auto sm:min-h-9";
