import "i18next";
import type { Resources } from "./i18n";

declare module "i18next" {
	interface CustomTypeOptions {
		defaultNS: "common";
		resources: Resources;
	}
}
