import type { LinkProps } from "@tanstack/react-router";
import type { ParseKeys } from "i18next";
import { HouseIcon, type LucideIcon, SettingsIcon } from "lucide-react";

type NavItem = {
	to: NonNullable<LinkProps["to"]>;
	labelKey: ParseKeys<"common">;
	icon: LucideIcon;
};

/** The app's primary navigation: the sidebar and the mobile sheet both render it. */
export const appNavigation: NavItem[] = [
	{ to: "/", labelKey: "nav.home", icon: HouseIcon },
	{ to: "/settings", labelKey: "nav.settings", icon: SettingsIcon },
];
