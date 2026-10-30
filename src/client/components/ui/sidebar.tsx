import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { PanelLeftIcon } from "lucide-react";
import {
	type ComponentProps,
	type CSSProperties,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";

import { Button } from "#/client/components/ui/button";
import { Input } from "#/client/components/ui/input";
import { Separator } from "#/client/components/ui/separator";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "#/client/components/ui/sheet";
import { Skeleton } from "#/client/components/ui/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "#/client/components/ui/tooltip";
import { useMediaQuery } from "#/client/hooks/use-media-query";
import { useIsMobile } from "#/client/hooks/use-mobile";
import { cn } from "#/lib/cn";
import { writePreferenceCookie } from "#/lib/cookies";
import { SIDEBAR_COOKIE, type SidebarMode } from "#/lib/sidebar-state";

const SIDEBAR_WIDTH = "16.25rem";
const SIDEBAR_WIDTH_MOBILE = "18rem";
const SIDEBAR_WIDTH_ICON = "4rem";
const SIDEBAR_KEYBOARD_SHORTCUT = "b";
const WIDE_QUERY = "(min-width: 1024px)";

type SidebarContextProps = {
	/** The persisted choice; `auto` leaves the width to CSS. */
	mode: SidebarMode;
	/**
	 * Whether the full sidebar shows at the current width. Resolved after
	 * hydration, so use it for behaviour (tooltips, aria), never for layout.
	 */
	state: "expanded" | "collapsed";
	/** Persists an explicit desktop choice to the cookie. */
	setMode: (mode: SidebarMode) => void;
	openMobile: boolean;
	setOpenMobile: (open: boolean) => void;
	/** The full sidebar floating over the content at 768–1023px (never persisted). */
	overlayOpen: boolean;
	setOverlayOpen: (open: boolean) => void;
	/** Closes the tablet overlay and returns focus to the toggle that opened it. */
	closeOverlay: () => void;
	isMobile: boolean;
	toggleSidebar: () => void;
	/** Closes the mobile sheet and the tablet overlay, e.g. after navigating. */
	dismiss: () => void;
};

const SidebarContext = createContext<SidebarContextProps | null>(null);

function useSidebar() {
	const context = useContext(SidebarContext);
	if (!context) {
		throw new Error("useSidebar must be used within a SidebarProvider.");
	}

	return context;
}

/**
 * Below 768px the sidebar is a sheet; at 768–1023px an icon rail that opens
 * as an overlay; from 1024px it follows `mode` (default full width).
 */
function SidebarProvider({
	defaultMode = "auto",
	className,
	style,
	children,
	...props
}: ComponentProps<"div"> & { defaultMode?: SidebarMode }) {
	const isMobile = useIsMobile();
	const isWide = useMediaQuery(WIDE_QUERY);
	const [openMobile, setOpenMobile] = useState(false);
	const [overlayOpen, setOverlayOpen] = useState(false);
	const [mode, setModeState] = useState(defaultMode);
	const wrapperRef = useRef<HTMLDivElement>(null);

	const setMode = useCallback((next: SidebarMode) => {
		setModeState(next);
		writePreferenceCookie(SIDEBAR_COOKIE, next);
	}, []);

	const state = isWide
		? mode === "collapsed"
			? "collapsed"
			: "expanded"
		: overlayOpen
			? "expanded"
			: "collapsed";

	const toggleSidebar = useCallback(() => {
		if (isMobile) setOpenMobile((open) => !open);
		else if (isWide) setMode(state === "expanded" ? "collapsed" : "expanded");
		else setOverlayOpen((open) => !open);
	}, [isMobile, isWide, setMode, state]);

	const dismiss = useCallback(() => {
		setOpenMobile(false);
		setOverlayOpen(false);
	}, []);

	const closeOverlay = useCallback(() => {
		setOverlayOpen(false);
		wrapperRef.current
			?.querySelector<HTMLElement>("[data-sidebar=trigger]")
			?.focus();
	}, []);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (
				event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
				(event.metaKey || event.ctrlKey)
			) {
				event.preventDefault();
				toggleSidebar();
			} else if (
				event.key === "Escape" &&
				overlayOpen &&
				// A menu or dialog inside the overlay already handled this Escape.
				!event.defaultPrevented
			) {
				closeOverlay();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [toggleSidebar, overlayOpen, closeOverlay]);

	const contextValue = useMemo<SidebarContextProps>(
		() => ({
			mode,
			state,
			setMode,
			isMobile,
			openMobile,
			setOpenMobile,
			overlayOpen,
			setOverlayOpen,
			closeOverlay,
			toggleSidebar,
			dismiss,
		}),
		[
			mode,
			state,
			setMode,
			isMobile,
			openMobile,
			overlayOpen,
			closeOverlay,
			toggleSidebar,
			dismiss,
		],
	);

	return (
		<SidebarContext.Provider value={contextValue}>
			<TooltipProvider delayDuration={0}>
				<div
					ref={wrapperRef}
					data-slot="sidebar-wrapper"
					data-sidebar-mode={mode}
					data-sidebar-overlay={overlayOpen ? "" : undefined}
					style={
						{
							// Widened by the left safe-area inset (a landscape phone's notch,
							// with viewport-fit=cover); the panel pads it back out.
							"--sidebar-width": `calc(${SIDEBAR_WIDTH} + env(safe-area-inset-left))`,
							"--sidebar-width-icon": `calc(${SIDEBAR_WIDTH_ICON} + env(safe-area-inset-left))`,
							...style,
						} as CSSProperties
					}
					className={cn(
						"group/sidebar-wrapper has-data-[variant=inset]:bg-sidebar flex min-h-svh w-full",
						className,
					)}
					{...props}
				>
					{children}
				</div>
			</TooltipProvider>
		</SidebarContext.Provider>
	);
}

function Sidebar({
	side = "left",
	variant = "sidebar",
	collapsible = "icon",
	className,
	children,
	...props
}: ComponentProps<"div"> & {
	side?: "left" | "right";
	variant?: "sidebar" | "floating" | "inset";
	collapsible?: "icon" | "none";
}) {
	const { isMobile, state, openMobile, setOpenMobile, closeOverlay } =
		useSidebar();
	const { t } = useTranslation();

	if (collapsible === "none") {
		return (
			<div
				data-slot="sidebar"
				className={cn(
					"bg-sidebar text-sidebar-foreground flex h-full w-(--sidebar-width) flex-col",
					className,
				)}
				{...props}
			>
				{children}
			</div>
		);
	}

	if (isMobile) {
		return (
			<Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
				<SheetContent
					data-sidebar="sidebar"
					data-slot="sidebar"
					data-mobile="true"
					className="bg-sidebar text-sidebar-foreground w-(--sidebar-width) gap-0 p-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] data-[side=left]:pl-[env(safe-area-inset-left)] data-[side=right]:pr-[env(safe-area-inset-right)] [&>button]:hidden"
					data-side={side}
					style={
						{
							"--sidebar-width": SIDEBAR_WIDTH_MOBILE,
						} as CSSProperties
					}
					side={side}
				>
					<SheetHeader className="sr-only">
						<SheetTitle>{t("sidebar.title")}</SheetTitle>
						<SheetDescription>{t("sidebar.description")}</SheetDescription>
					</SheetHeader>
					<div className="flex h-full w-full flex-col">{children}</div>
				</SheetContent>
			</Sheet>
		);
	}

	return (
		<div
			className="group peer text-sidebar-foreground hidden md:block"
			data-state={state}
			data-variant={variant}
			data-side={side}
			data-slot="sidebar"
		>
			{/* Reserves the sidebar's width in the flow; the rail's width while it floats. */}
			<div
				data-slot="sidebar-gap"
				className={cn(
					"relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-out",
					"group-data-[side=right]:rotate-180",
					variant === "floating" || variant === "inset"
						? "rail:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))] sidebar-overlay:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]"
						: "rail:w-(--sidebar-width-icon) sidebar-overlay:w-(--sidebar-width-icon)",
				)}
			/>
			{/* Clicking outside the tablet overlay closes it. */}
			<button
				type="button"
				tabIndex={-1}
				aria-label={t("sidebar.close")}
				onClick={closeOverlay}
				className="bg-overlay animate-in fade-in-0 fixed inset-0 z-20 hidden sidebar-overlay:block"
			/>
			{/* A landmark, so the brand and account menu around the <nav> are in one. */}
			<aside
				aria-label={t("sidebar.title")}
				data-slot="sidebar-container"
				className={cn(
					"fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[width] duration-200 ease-out md:flex",
					"sidebar-overlay:z-30 sidebar-overlay:shadow-xl",
					side === "left" ? "left-0" : "right-0",
					// Adjust the padding for floating and inset variants.
					variant === "floating" || variant === "inset"
						? "p-2 rail:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]"
						: "rail:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l",
					className,
				)}
				{...props}
			>
				<div
					data-sidebar="sidebar"
					data-slot="sidebar-inner"
					className="bg-sidebar group-data-[variant=floating]:border-sidebar-border flex h-full w-full flex-col pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:shadow-sm"
				>
					{children}
				</div>
			</aside>
		</div>
	);
}

function SidebarTrigger({
	className,
	onClick,
	...props
}: ComponentProps<typeof Button>) {
	const { toggleSidebar, isMobile, openMobile, state } = useSidebar();
	const { t } = useTranslation();

	return (
		<Button
			data-sidebar="trigger"
			data-slot="sidebar-trigger"
			variant="ghost"
			size="icon"
			aria-expanded={isMobile ? openMobile : state === "expanded"}
			className={cn("size-8", className)}
			onClick={(event) => {
				onClick?.(event);
				toggleSidebar();
			}}
			{...props}
		>
			<PanelLeftIcon />
			<span className="sr-only">{t("sidebar.toggle")}</span>
		</Button>
	);
}

function SidebarRail({ className, ...props }: ComponentProps<"button">) {
	const { toggleSidebar } = useSidebar();
	const { t } = useTranslation();

	return (
		<button
			data-sidebar="rail"
			data-slot="sidebar-rail"
			aria-label={t("sidebar.toggle")}
			tabIndex={-1}
			onClick={toggleSidebar}
			title={t("sidebar.toggle")}
			className={cn(
				"hover:after:bg-sidebar-border absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] sm:flex",
				"in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize",
				"[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize",
				className,
			)}
			{...props}
		/>
	);
}

function SidebarInset({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-inset"
			className={cn(
				"bg-background relative flex w-full min-w-0 flex-1 flex-col md:pr-[env(safe-area-inset-right)]",
				"md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2",
				className,
			)}
			{...props}
		/>
	);
}

function SidebarInput({ className, ...props }: ComponentProps<typeof Input>) {
	return (
		<Input
			data-slot="sidebar-input"
			data-sidebar="input"
			className={cn("bg-background h-8 w-full shadow-none", className)}
			{...props}
		/>
	);
}

function SidebarHeader({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-header"
			data-sidebar="header"
			className={cn("flex flex-col gap-2 p-2 rail:items-center", className)}
			{...props}
		/>
	);
}

function SidebarFooter({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-footer"
			data-sidebar="footer"
			className={cn("flex flex-col gap-2 p-2 rail:items-center", className)}
			{...props}
		/>
	);
}

function SidebarSeparator({
	className,
	...props
}: ComponentProps<typeof Separator>) {
	return (
		<Separator
			data-slot="sidebar-separator"
			data-sidebar="separator"
			className={cn("bg-sidebar-border mx-2 w-auto", className)}
			{...props}
		/>
	);
}

function SidebarContent({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-content"
			data-sidebar="content"
			className={cn(
				"flex min-h-0 flex-1 flex-col gap-2 overflow-auto rail:overflow-hidden",
				className,
			)}
			{...props}
		/>
	);
}

function SidebarGroup({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-group"
			data-sidebar="group"
			className={cn("relative flex w-full min-w-0 flex-col p-2", className)}
			{...props}
		/>
	);
}

function SidebarGroupLabel({
	className,
	asChild = false,
	...props
}: ComponentProps<"div"> & { asChild?: boolean }) {
	const Comp = asChild ? Slot : "div";

	return (
		<Comp
			data-slot="sidebar-group-label"
			data-sidebar="group-label"
			className={cn(
				"text-sidebar-foreground/70 ring-sidebar-ring flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium outline-hidden transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
				"rail:-mt-8 rail:opacity-0",
				className,
			)}
			{...props}
		/>
	);
}

function SidebarGroupAction({
	className,
	asChild = false,
	...props
}: ComponentProps<"button"> & { asChild?: boolean }) {
	const Comp = asChild ? Slot : "button";

	return (
		<Comp
			data-slot="sidebar-group-action"
			data-sidebar="group-action"
			className={cn(
				"text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
				// Grows the hit area to 44px on touch screens.
				"after:absolute after:-inset-3 pointer-fine:after:hidden",
				"rail:hidden",
				className,
			)}
			{...props}
		/>
	);
}

function SidebarGroupContent({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-group-content"
			data-sidebar="group-content"
			className={cn("w-full text-sm", className)}
			{...props}
		/>
	);
}

function SidebarMenu({ className, ...props }: ComponentProps<"ul">) {
	return (
		<ul
			data-slot="sidebar-menu"
			data-sidebar="menu"
			className={cn(
				"flex w-full min-w-0 flex-col gap-1 rail:items-center",
				className,
			)}
			{...props}
		/>
	);
}

function SidebarMenuItem({ className, ...props }: ComponentProps<"li">) {
	return (
		<li
			data-slot="sidebar-menu-item"
			data-sidebar="menu-item"
			className={cn("group/menu-item relative", className)}
			{...props}
		/>
	);
}

const sidebarMenuButtonVariants = cva(
	"peer/menu-button flex w-full pointer-coarse:min-h-11 items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground rail:size-10! rail:justify-center rail:p-0! rail:pointer-coarse:size-11! rail:[&>span:last-child]:sr-only data-[status=active]:bg-sidebar-accent data-[status=active]:font-medium data-[status=active]:text-sidebar-accent-foreground [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
	{
		variants: {
			variant: {
				default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
				outline:
					"bg-background shadow-[0_0_0_1px_var(--sidebar-border)] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_var(--sidebar-accent)]",
			},
			size: {
				default: "h-8 text-sm",
				sm: "h-7 text-xs",
				lg: "h-12 text-sm rail:p-0!",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

function SidebarMenuButton({
	asChild = false,
	isActive = false,
	variant = "default",
	size = "default",
	tooltip,
	className,
	...props
}: ComponentProps<"button"> & {
	asChild?: boolean;
	isActive?: boolean;
	tooltip?: string | ComponentProps<typeof TooltipContent>;
} & VariantProps<typeof sidebarMenuButtonVariants>) {
	const Comp = asChild ? Slot : "button";
	const { isMobile, state } = useSidebar();
	const [tooltipOpen, setTooltipOpen] = useState(false);

	const button = (
		<Comp
			data-slot="sidebar-menu-button"
			data-sidebar="menu-button"
			data-size={size}
			data-active={isActive}
			className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
			{...props}
		/>
	);

	if (!tooltip) {
		return button;
	}

	if (typeof tooltip === "string") {
		tooltip = {
			children: tooltip,
		};
	}

	// Only the rail labels its icons. Kept closed (not just hidden) otherwise: an
	// open tooltip would swallow the next Escape meant for the overlay.
	const showTooltip = state === "collapsed" && !isMobile;
	return (
		<Tooltip open={tooltipOpen && showTooltip} onOpenChange={setTooltipOpen}>
			<TooltipTrigger asChild>{button}</TooltipTrigger>
			<TooltipContent side="right" align="center" {...tooltip} />
		</Tooltip>
	);
}

function SidebarMenuAction({
	className,
	asChild = false,
	showOnHover = false,
	...props
}: ComponentProps<"button"> & {
	asChild?: boolean;
	showOnHover?: boolean;
}) {
	const Comp = asChild ? Slot : "button";

	return (
		<Comp
			data-slot="sidebar-menu-action"
			data-sidebar="menu-action"
			className={cn(
				"text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground peer-hover/menu-button:text-sidebar-accent-foreground absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
				// Grows the hit area to 44px on touch screens.
				"after:absolute after:-inset-3 pointer-fine:after:hidden",
				"peer-data-[size=sm]/menu-button:top-1",
				"peer-data-[size=default]/menu-button:top-1.5",
				// sm/default buttons grow to 44px on touch screens: stay centred.
				"pointer-coarse:peer-data-[size=sm]/menu-button:top-3",
				"pointer-coarse:peer-data-[size=default]/menu-button:top-3",
				"peer-data-[size=lg]/menu-button:top-2.5",
				"rail:hidden",
				showOnHover &&
					"peer-data-[active=true]/menu-button:text-sidebar-accent-foreground group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 md:opacity-0",
				className,
			)}
			{...props}
		/>
	);
}

function SidebarMenuBadge({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-menu-badge"
			data-sidebar="menu-badge"
			className={cn(
				"text-sidebar-foreground pointer-events-none absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums select-none",
				"peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground",
				"peer-data-[size=sm]/menu-button:top-1",
				"peer-data-[size=default]/menu-button:top-1.5",
				// sm/default buttons grow to 44px on touch screens: stay centred.
				"pointer-coarse:peer-data-[size=sm]/menu-button:top-3",
				"pointer-coarse:peer-data-[size=default]/menu-button:top-3",
				"peer-data-[size=lg]/menu-button:top-2.5",
				"rail:hidden",
				className,
			)}
			{...props}
		/>
	);
}

function SidebarMenuSkeleton({
	className,
	showIcon = false,
	width = "70%",
	...props
}: ComponentProps<"div"> & {
	showIcon?: boolean;
	/** Vary it per row; never random, which would differ between server and client. */
	width?: string;
}) {
	return (
		<div
			data-slot="sidebar-menu-skeleton"
			data-sidebar="menu-skeleton"
			className={cn("flex h-8 items-center gap-2 rounded-md px-2", className)}
			{...props}
		>
			{showIcon && (
				<Skeleton
					className="size-4 rounded-md"
					data-sidebar="menu-skeleton-icon"
				/>
			)}
			<Skeleton
				className="h-4 max-w-(--skeleton-width) flex-1"
				data-sidebar="menu-skeleton-text"
				style={
					{
						"--skeleton-width": width,
					} as CSSProperties
				}
			/>
		</div>
	);
}

function SidebarMenuSub({ className, ...props }: ComponentProps<"ul">) {
	return (
		<ul
			data-slot="sidebar-menu-sub"
			data-sidebar="menu-sub"
			className={cn(
				"border-sidebar-border mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l px-2.5 py-0.5",
				"rail:hidden",
				className,
			)}
			{...props}
		/>
	);
}

function SidebarMenuSubItem({ className, ...props }: ComponentProps<"li">) {
	return (
		<li
			data-slot="sidebar-menu-sub-item"
			data-sidebar="menu-sub-item"
			className={cn("group/menu-sub-item relative", className)}
			{...props}
		/>
	);
}

function SidebarMenuSubButton({
	asChild = false,
	size = "md",
	isActive = false,
	className,
	...props
}: ComponentProps<"a"> & {
	asChild?: boolean;
	size?: "sm" | "md";
	isActive?: boolean;
}) {
	const Comp = asChild ? Slot : "a";

	return (
		<Comp
			data-slot="sidebar-menu-sub-button"
			data-sidebar="menu-sub-button"
			data-size={size}
			data-active={isActive}
			className={cn(
				"text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground [&>svg]:text-sidebar-accent-foreground flex h-7 min-w-0 -translate-x-px pointer-coarse:min-h-11 items-center gap-2 overflow-hidden rounded-md px-2 outline-hidden focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
				"data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground",
				size === "sm" && "text-xs",
				size === "md" && "text-sm",
				"rail:hidden",
				className,
			)}
			{...props}
		/>
	);
}

export {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupAction,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInput,
	SidebarInset,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSkeleton,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	SidebarProvider,
	SidebarRail,
	SidebarSeparator,
	SidebarTrigger,
	useSidebar,
};
