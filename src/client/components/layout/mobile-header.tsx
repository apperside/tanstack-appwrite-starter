import { MenuIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "#/client/components/ui/button";
import { useSidebar } from "#/client/components/ui/sidebar";
import { BrandLink } from "./brand";
import { UserMenu } from "./user-menu";

/** Below 768px: menu button (opens the navigation sheet), brand, account menu. */
export function MobileHeader() {
	const { t } = useTranslation();
	const { openMobile, setOpenMobile } = useSidebar();
	return (
		<header className="bg-background/95 supports-backdrop-filter:bg-background/80 sticky top-0 z-10 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center gap-2 border-b pt-[env(safe-area-inset-top)] pr-[max(0.5rem,env(safe-area-inset-right))] pl-[max(0.5rem,env(safe-area-inset-left))] backdrop-blur md:hidden">
			<Button
				variant="ghost"
				size="icon"
				aria-expanded={openMobile}
				onClick={() => setOpenMobile(true)}
			>
				<MenuIcon aria-hidden />
				<span className="sr-only">{t("sidebar.open")}</span>
			</Button>
			<BrandLink className="min-w-0 flex-1" />
			<UserMenu variant="header" />
		</header>
	);
}
