import { describe, expect, it } from "vitest";
import { AppError } from "#/lib/errors";
import {
	createI18n,
	loadedResources,
	loadI18n,
	loadResources,
	primeResources,
} from "./i18n";
import type en from "./locales/en";

describe("loadI18n", () => {
	it("creates a ready instance holding only the requested locale", async () => {
		const i18n = await loadI18n("it");
		expect(i18n.isInitialized).toBe(true);
		expect(i18n.language).toBe("it");
		expect(i18n.t("auth:login.title")).toBe("Accedi");
		expect(i18n.hasResourceBundle("en", "common")).toBe(false);
	});

	it("creates a new instance per call (never shared across requests)", async () => {
		const [a, b] = await Promise.all([loadI18n("en"), loadI18n("en")]);
		expect(a).not.toBe(b);
		await a.changeLanguage("it");
		expect(b.language).toBe("en");
	});

	it("uses common as the default namespace", async () => {
		const i18n = await loadI18n("en");
		expect(i18n.t("actions.close")).toBe("Close");
	});

	it("translates every AppError code through its i18nKey", async () => {
		const i18n = await loadI18n("en");
		expect(i18n.t(new AppError("RATE_LIMITED").i18nKey)).toBe(
			"Too many attempts. Please wait a few minutes and try again.",
		);
	});

	it("type-checks keys", async () => {
		const i18n = await loadI18n("en");
		// @ts-expect-error -- a missing key is a compile error
		expect(i18n.t("auth:login.nope")).toBe("login.nope");
	});
});

describe("loadResources", () => {
	it("loads each locale once and exposes it synchronously afterwards", async () => {
		const first = loadResources("en");
		expect(loadResources("en")).toBe(first);
		const resources = await first;
		expect(loadedResources("en")).toBe(resources);
		expect(createI18n("en", resources).t("appName")).toBe("My App");
	});
});

describe("primeResources", () => {
	it("serves dehydrated resources without loading the chunk", async () => {
		const sent = { common: { appName: "Sent" } } as unknown as typeof en;
		primeResources("it", sent);
		expect(loadedResources("it")).toBe(sent);
		await expect(loadResources("it")).resolves.toBe(sent);
	});
});
