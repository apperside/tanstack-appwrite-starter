import { Link } from "@tanstack/react-router";
import {
	ChevronsUpDownIcon,
	LogOutIcon,
	SettingsIcon,
	SunMoonIcon,
	UserIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback } from "#/client/components/ui/avatar";
import { Button } from "#/client/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "#/client/components/ui/dropdown-menu";
import { SidebarMenuButton, useSidebar } from "#/client/components/ui/sidebar";
import { useThemePreference } from "#/client/features/account/hooks/use-preference";
import {
	isThemePreference,
	THEME_OPTIONS,
} from "#/client/features/account/theme-options";
import { useCurrentUser } from "#/client/features/auth/hooks/use-current-user";
import { useSignOut } from "#/client/features/auth/hooks/use-sign-out";
import { isGuest } from "#/lib/guards";
import { initials } from "#/lib/initials";

function useIdentity() {
	const { t } = useTranslation();
	const user = useCurrentUser();
	const guest = !user || isGuest(user);
	return {
		name: guest ? t("userMenu.guest") : user.name || user.email,
		detail: guest ? t("userMenu.guestHint") : user.email,
		initials: guest ? "" : initials(user.name || user.email),
	};
}

function UserAvatar({ initials }: { initials: string }) {
	return (
		<Avatar className="size-8 rounded-lg">
			<AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground rounded-lg text-xs font-medium">
				{initials || <UserIcon className="size-4" aria-hidden />}
			</AvatarFallback>
		</Avatar>
	);
}

/**
 * The account menu: identity, settings, theme and sign out. `sidebar` is the
 * row at the foot of the sidebar (avatar only on the rail); `header` is the
 * avatar button of the mobile header.
 */
export function UserMenu({ variant }: { variant: "sidebar" | "header" }) {
	const { t } = useTranslation(["common", "errors"]);
	const identity = useIdentity();
	const { isMobile, dismiss } = useSidebar();
	const [theme, setTheme] = useThemePreference();
	const signOut = useSignOut();

	const trigger =
		variant === "sidebar" ? (
			<SidebarMenuButton
				size="lg"
				tooltip={identity.name}
				className="data-[state=open]:bg-sidebar-accent"
			>
				<UserAvatar initials={identity.initials} />
				<span className="grid flex-1 text-left leading-tight rail:sr-only">
					<span className="truncate text-sm font-medium">{identity.name}</span>
					<span className="text-muted-foreground truncate text-xs">
						{identity.detail}
					</span>
				</span>
				<ChevronsUpDownIcon
					aria-hidden
					className="text-muted-foreground ml-auto rail:hidden"
				/>
			</SidebarMenuButton>
		) : (
			<Button variant="ghost" size="icon" className="rounded-lg">
				<UserAvatar initials={identity.initials} />
				<span className="sr-only">{t("userMenu.trigger")}</span>
			</Button>
		);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
			<DropdownMenuContent
				className="w-(--radix-dropdown-menu-trigger-width) min-w-60 rounded-lg"
				side={variant === "sidebar" && !isMobile ? "right" : "bottom"}
				align="end"
				sideOffset={8}
			>
				<DropdownMenuLabel className="flex items-center gap-2 font-normal">
					<UserAvatar initials={identity.initials} />
					<span className="grid min-w-0 flex-1 leading-tight">
						<span className="truncate text-sm font-medium">
							{identity.name}
						</span>
						<span className="text-muted-foreground truncate text-xs">
							{identity.detail}
						</span>
					</span>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem asChild>
						<Link to="/settings" onClick={dismiss}>
							<SettingsIcon aria-hidden />
							{t("nav.settings")}
						</Link>
					</DropdownMenuItem>
					<DropdownMenuSub>
						<DropdownMenuSubTrigger className="gap-2">
							<SunMoonIcon
								aria-hidden
								className="text-muted-foreground size-4"
							/>
							{t("userMenu.theme")}
						</DropdownMenuSubTrigger>
						<DropdownMenuSubContent>
							<DropdownMenuRadioGroup
								value={theme}
								onValueChange={(value) => {
									if (isThemePreference(value)) setTheme(value);
								}}
							>
								{THEME_OPTIONS.map(({ value, icon: Icon }) => (
									<DropdownMenuRadioItem key={value} value={value}>
										<Icon aria-hidden />
										{t(`theme.${value}`)}
									</DropdownMenuRadioItem>
								))}
							</DropdownMenuRadioGroup>
						</DropdownMenuSubContent>
					</DropdownMenuSub>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					disabled={signOut.isPending}
					onSelect={() => signOut.mutate()}
				>
					<LogOutIcon aria-hidden />
					{t("userMenu.signOut")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
