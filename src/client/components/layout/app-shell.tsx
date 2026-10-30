import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { SidebarInset, SidebarProvider } from "#/client/components/ui/sidebar";
import type { SidebarMode } from "#/lib/sidebar-state";
import { AppSidebar } from "./app-sidebar";
import { GuestBanner } from "./guest-banner";
import { MainLandmark } from "./main-landmark";
import { MobileHeader } from "./mobile-header";

const MAIN_ID = "main";

/**
 * The signed-in frame. ≥1024px: 260px sidebar, collapsible to a 64px rail
 * (remembered). 768–1023px: the rail, opening the full sidebar as an overlay.
 * <768px: a header with a navigation sheet. Widths come from CSS, so the
 * server's first paint is final.
 */
export function AppShell({
	sidebarMode,
	guestBannerDismissed = false,
	children,
}: {
	/** The `sidebar_state` cookie, read on the server. */
	sidebarMode: SidebarMode;
	/** The `guest_banner_dismissed` cookie, read on the server. */
	guestBannerDismissed?: boolean;
	children: ReactNode;
}) {
	const { t } = useTranslation();
	return (
		<SidebarProvider defaultMode={sidebarMode}>
			<a
				href={`#${MAIN_ID}`}
				className="bg-background focus-visible:ring-ring/70 sr-only z-50 rounded-md px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus-visible:ring-[3px]"
			>
				{t("nav.skip")}
			</a>
			<AppSidebar />
			<SidebarInset>
				<MobileHeader />
				<GuestBanner defaultDismissed={guestBannerDismissed} />
				<MainLandmark
					id={MAIN_ID}
					tabIndex={-1}
					className="flex flex-1 flex-col outline-none"
				>
					{children}
				</MainLandmark>
			</SidebarInset>
		</SidebarProvider>
	);
}
