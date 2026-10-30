import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarTrigger,
	useSidebar,
} from "#/client/components/ui/sidebar";
import { appNavigation } from "./app-navigation";
import { BrandLink } from "./brand";
import { UserMenu } from "./user-menu";

/** The shell's sidebar: brand + toggle, primary navigation, account menu. */
export function AppSidebar() {
	const { t } = useTranslation();
	const { dismiss } = useSidebar();
	return (
		<Sidebar collapsible="icon">
			<SidebarHeader className="h-14 flex-row items-center justify-between gap-2 px-3 rail:justify-center rail:px-2">
				<BrandLink className="min-w-0 rail:hidden" />
				<SidebarTrigger className="text-muted-foreground" />
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup className="rail:px-0">
					<SidebarGroupContent>
						<nav aria-label={t("nav.label")}>
							<SidebarMenu>
								{appNavigation.map(({ to, labelKey, icon: Icon }) => (
									<SidebarMenuItem key={to}>
										<SidebarMenuButton asChild tooltip={t(labelKey)}>
											<Link
												to={to}
												activeOptions={{ exact: to === "/" }}
												onClick={dismiss}
											>
												<Icon aria-hidden />
												<span>{t(labelKey)}</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								))}
							</SidebarMenu>
						</nav>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<UserMenu variant="sidebar" />
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
