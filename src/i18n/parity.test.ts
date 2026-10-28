import { describe, expect, it } from "vitest";
import { loadResources } from "./i18n";
import { LOCALES } from "./locale";

/** Dotted paths of every leaf string, e.g. `login.title`. */
function flattenKeys(value: unknown, prefix = ""): string[] {
	if (typeof value !== "object" || value === null) return [prefix];
	return Object.entries(value).flatMap(([key, child]) =>
		flattenKeys(child, prefix ? `${prefix}.${key}` : key),
	);
}

describe("translation parity", async () => {
	const [en, ...others] = await Promise.all(LOCALES.map(loadResources));

	it("ships at least one namespace", () => {
		expect(Object.keys(en).length).toBeGreaterThan(0);
	});

	for (const [index, resources] of others.entries()) {
		const locale = LOCALES[index + 1];
		it(`${locale} has the same namespaces as en`, () => {
			expect(Object.keys(resources).sort()).toEqual(Object.keys(en).sort());
		});

		for (const namespace of Object.keys(en) as (keyof typeof en)[]) {
			it(`${locale}:${namespace} has the same keys as en`, () => {
				expect(flattenKeys(resources[namespace]).sort()).toEqual(
					flattenKeys(en[namespace]).sort(),
				);
			});

			it(`${locale}:${namespace} has no empty strings`, () => {
				const empty = flattenKeys(resources[namespace]).filter((path) => {
					const leaf = path
						.split(".")
						.reduce<unknown>(
							(node, key) => (node as Record<string, unknown>)[key],
							resources[namespace],
						);
					return typeof leaf !== "string" || leaf.trim() === "";
				});
				expect(empty).toEqual([]);
			});
		}
	}
});
