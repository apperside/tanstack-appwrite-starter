import { type ReactNode, useEffect, useRef } from "react";
import { BrandLink } from "./brand";
import { MainLandmark } from "./main-landmark";

/**
 * The frame of every signed-out page: full-bleed below 640px, a centred
 * `max-w-sm` card from 640px. Shared by `AuthLayout` and its skeleton so the
 * swap between them never moves anything.
 */
export function AuthFrame({ children }: { children: ReactNode }) {
	return (
		<div className="bg-background sm:bg-muted/50 sm:dark:bg-background flex min-h-svh flex-col sm:items-center sm:justify-center sm:p-6">
			<MainLandmark className="bg-background sm:bg-card flex w-full flex-1 flex-col gap-8 pt-[max(2.5rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(2.5rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] sm:max-w-sm sm:flex-none sm:rounded-xl sm:border sm:p-8 sm:shadow-sm">
				{children}
			</MainLandmark>
		</div>
	);
}

type Props = {
	title: string;
	subtitle?: string;
	children: ReactNode;
	/** Secondary links under the body, e.g. "No account? Sign up". */
	footer?: ReactNode;
	/**
	 * Moves focus to the title when it appears or changes. For a state reached
	 * by an action (e.g. "Check your email" after submitting), so the focus
	 * does not fall to `<body>` with the removed form and the new state is read.
	 */
	focusTitle?: boolean;
};

/**
 * The content of a signed-out page: brand, title, body, footer. Inside the
 * `_public` layout (which renders the `AuthFrame`, so it stays put between
 * login and signup); elsewhere use `AuthLayout`.
 */
export function AuthPanel({
	title,
	subtitle,
	children,
	footer,
	focusTitle = false,
}: Props) {
	const titleRef = useRef<HTMLHeadingElement>(null);
	useEffect(() => {
		if (focusTitle && title) titleRef.current?.focus();
	}, [focusTitle, title]);
	return (
		<>
			<header className="flex flex-col gap-6">
				<BrandLink className="self-start" />
				<div className="flex flex-col gap-1.5">
					<h1
						ref={titleRef}
						tabIndex={focusTitle ? -1 : undefined}
						className="text-2xl font-semibold tracking-tight text-balance outline-none"
					>
						{title}
					</h1>
					{subtitle && (
						<p className="text-muted-foreground text-sm text-pretty">
							{subtitle}
						</p>
					)}
				</div>
			</header>
			{children}
			{footer && (
				<footer className="text-muted-foreground text-center text-sm text-pretty">
					{footer}
				</footer>
			)}
		</>
	);
}

/** A standalone signed-out page: the `AuthFrame` around an `AuthPanel`. */
export function AuthLayout(props: Props) {
	return (
		<AuthFrame>
			<AuthPanel {...props} />
		</AuthFrame>
	);
}
